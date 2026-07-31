package com.synapse.notes;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "ImageSaver",
    permissions = { @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "legacyStorage") }
)
public class ImageSaverPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "legacyStoragePermissionCallback");
            return;
        }

        saveImageAsync(call);
    }

    @PermissionCallback
    private void legacyStoragePermissionCallback(PluginCall call) {
        if (getPermissionState("legacyStorage") == PermissionState.GRANTED) {
            saveImageAsync(call);
        } else {
            call.reject("Storage permission is required to save images on this Android version.");
        }
    }

    private void saveImageAsync(PluginCall call) {
        String urlValue = call.getString("url");
        String requestedName = call.getString("fileName", "synapse-visualization");

        if (urlValue == null || (!urlValue.startsWith("https://") && !urlValue.startsWith("http://"))) {
            call.reject("A valid image URL is required.");
            return;
        }

        executor.submit(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(urlValue).openConnection();
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(30_000);
                connection.setInstanceFollowRedirects(true);
                connection.connect();

                int responseCode = connection.getResponseCode();
                if (responseCode < 200 || responseCode >= 300) {
                    throw new IllegalStateException("Image download failed (HTTP " + responseCode + ")");
                }

                String mimeType = normalizedMimeType(connection.getContentType(), urlValue);
                String displayName = sanitizeFileName(requestedName) + extensionFor(mimeType);

                try (InputStream input = connection.getInputStream()) {
                    SaveResult result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? saveWithMediaStore(input, displayName, mimeType)
                        : saveLegacy(input, displayName, mimeType);

                    JSObject payload = new JSObject();
                    payload.put("uri", result.uri);
                    payload.put("displayName", displayName);
                    payload.put("relativePath", "Pictures/Synapse Notes");
                    call.resolve(payload);
                }
            } catch (Exception error) {
                call.reject(error.getMessage() != null ? error.getMessage() : "Could not save image", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private SaveResult saveWithMediaStore(InputStream input, String displayName, String mimeType) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, displayName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Synapse Notes");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("Android could not create the image file.");

        try {
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("Android could not open the image file.");
                copy(input, output);
            }
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return new SaveResult(uri.toString());
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            throw error;
        }
    }

    @SuppressWarnings("deprecation")
    private SaveResult saveLegacy(InputStream input, String displayName, String mimeType) throws Exception {
        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Synapse Notes");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Android could not create the Synapse Notes picture folder.");
        }

        File imageFile = new File(directory, displayName);
        try (OutputStream output = new FileOutputStream(imageFile)) {
            copy(input, output);
        }

        MediaScannerConnection.scanFile(getContext(), new String[] { imageFile.getAbsolutePath() }, new String[] { mimeType }, null);
        return new SaveResult(Uri.fromFile(imageFile).toString());
    }

    private static void copy(InputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[16 * 1024];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        output.flush();
    }

    private static String sanitizeFileName(String value) {
        String sanitized = value.replaceAll("[^a-zA-Z0-9_-]", "-").replaceAll("-+", "-");
        return sanitized.isEmpty() ? "synapse-visualization" : sanitized.substring(0, Math.min(sanitized.length(), 72));
    }

    private static String normalizedMimeType(String contentType, String url) {
        String mime = contentType == null ? "" : contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (mime.equals("image/jpeg") || mime.equals("image/png") || mime.equals("image/webp")) return mime;
        String path = url.toLowerCase(Locale.ROOT).split("\\?")[0];
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    private static String extensionFor(String mimeType) {
        if (mimeType.equals("image/jpeg")) return ".jpg";
        if (mimeType.equals("image/webp")) return ".webp";
        return ".png";
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
    }

    private static final class SaveResult {
        final String uri;
        SaveResult(String uri) { this.uri = uri; }
    }
}
