import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Android hardware/gesture Back: pop in-app history; exit only from Home.
 * Tab switches should use replace so they do not stack a back trap.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return
    }

    const listener = App.addListener('backButton', ({ canGoBack }) => {
      const path = pathRef.current
      const onHome = path === '/' || path === ''

      if (onHome) {
        App.exitApp()
        return
      }

      if (canGoBack) {
        navigate(-1)
        return
      }

      navigate('/', { replace: true })
    })

    return () => {
      listener.then((handle) => handle.remove()).catch(() => {})
    }
  }, [navigate])
}
