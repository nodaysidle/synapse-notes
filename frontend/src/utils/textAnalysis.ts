/**
 * Text analysis utilities for knowledge graph connections
 * Extracts keywords and analyzes mood to connect notes by content, not time
 */

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us',
  'them', 'my', 'your', 'his', 'our', 'their', 'what', 'which', 'who', 'whom',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
  'if', 'because', 'until', 'while', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out',
  'off', 'over', 'under', 'again', 'further', 'am', 'been', 'being', 'get', 'got',
  'getting', 'go', 'going', 'went', 'gone', 'come', 'coming', 'came', 'make',
  'making', 'made', 'take', 'taking', 'took', 'taken', 'know', 'knowing', 'knew',
  'known', 'think', 'thinking', 'thought', 'see', 'seeing', 'saw', 'seen', 'want',
  'wanting', 'wanted', 'use', 'using', 'find', 'finding', 'found', 'give', 'giving',
  'gave', 'given', 'tell', 'telling', 'told', 'say', 'saying', 'said', 'thing',
  'things', 'something', 'anything', 'everything', 'nothing', 'one', 'two', 'first',
  'new', 'way', 'well', 'even', 'back', 'any', 'good', 'like', 'really', 'still',
  'much', 'right', 'yeah', 'yes', 'okay', 'ok', 'um', 'uh', 'ah', 'oh', 'hmm',
  'note', 'notes', 'untitled', 'today', 'yesterday', 'tomorrow'
])

// Mood word lists for simple sentiment analysis
const MOOD_WORDS = {
  // Positive moods
  happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'fantastic', 'love', 'loving', 'loved', 'awesome', 'excellent', 'brilliant', 'cheerful', 'delighted', 'pleased', 'thrilled', 'ecstatic', 'glad', 'content', 'satisfied', 'grateful', 'thankful', 'blessed', 'lucky', 'fortunate', 'celebration', 'celebrate', 'success', 'successful', 'win', 'winning', 'won', 'achieve', 'achievement', 'accomplish', 'proud', 'confidence', 'confident'],

  calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'quiet', 'gentle', 'soft', 'soothing', 'meditate', 'meditation', 'mindful', 'mindfulness', 'breathe', 'breathing', 'rest', 'resting', 'sleep', 'sleeping', 'ease', 'comfortable', 'cozy', 'warm', 'safe', 'secure', 'stable', 'balance', 'balanced', 'harmony', 'zen', 'stillness'],

  motivated: ['motivated', 'driven', 'determined', 'focused', 'goal', 'goals', 'ambition', 'ambitious', 'energy', 'energetic', 'productive', 'productivity', 'progress', 'improve', 'improvement', 'grow', 'growth', 'learn', 'learning', 'develop', 'development', 'challenge', 'challenging', 'opportunity', 'possibilities', 'potential', 'inspire', 'inspired', 'inspiration', 'passion', 'passionate', 'purpose', 'mission', 'vision'],

  creative: ['creative', 'creativity', 'idea', 'ideas', 'imagine', 'imagination', 'design', 'designing', 'art', 'artistic', 'create', 'creating', 'build', 'building', 'invent', 'invention', 'innovative', 'innovation', 'experiment', 'exploring', 'discover', 'discovery', 'write', 'writing', 'draw', 'drawing', 'paint', 'painting', 'music', 'compose', 'craft', 'project', 'brainstorm'],

  // Negative moods
  sad: ['sad', 'unhappy', 'depressed', 'depression', 'down', 'low', 'cry', 'crying', 'tears', 'grief', 'grieving', 'loss', 'lost', 'miss', 'missing', 'lonely', 'loneliness', 'alone', 'empty', 'emptiness', 'hopeless', 'despair', 'heartbreak', 'heartbroken', 'hurt', 'hurting', 'pain', 'painful', 'suffer', 'suffering', 'sorrow', 'melancholy', 'gloomy', 'disappointed', 'disappointment'],

  anxious: ['anxious', 'anxiety', 'worried', 'worry', 'worrying', 'nervous', 'stress', 'stressed', 'stressful', 'panic', 'panicking', 'fear', 'fearful', 'afraid', 'scared', 'terrified', 'dread', 'dreading', 'uncertain', 'uncertainty', 'doubt', 'doubting', 'insecure', 'insecurity', 'overwhelmed', 'overwhelming', 'pressure', 'tense', 'tension', 'restless', 'uneasy'],

  angry: ['angry', 'anger', 'mad', 'furious', 'rage', 'raging', 'frustrated', 'frustration', 'annoyed', 'annoying', 'irritated', 'irritating', 'upset', 'hate', 'hating', 'resent', 'resentment', 'bitter', 'bitterness', 'hostile', 'aggravated', 'outraged', 'infuriated', 'livid', 'fuming', 'enraged'],

  tired: ['tired', 'exhausted', 'exhaustion', 'fatigue', 'fatigued', 'drained', 'burnt', 'burnout', 'worn', 'weary', 'sleepy', 'drowsy', 'lethargic', 'sluggish', 'weak', 'depleted', 'spent', 'overworked', 'struggling', 'barely'],

  // Neutral/reflective
  reflective: ['think', 'thinking', 'reflect', 'reflection', 'ponder', 'pondering', 'consider', 'considering', 'wonder', 'wondering', 'question', 'questioning', 'curious', 'curiosity', 'analyze', 'analyzing', 'understand', 'understanding', 'realize', 'realization', 'insight', 'perspective', 'philosophy', 'meaning', 'purpose', 'life', 'existence', 'memory', 'memories', 'remember', 'remembering', 'past', 'future', 'present', 'time', 'change', 'changing']
}

// Assign mood categories scores for comparison
const MOOD_SCORES: Record<string, number> = {
  happy: 0.9,
  motivated: 0.8,
  creative: 0.7,
  calm: 0.5,
  reflective: 0.4,
  tired: 0.3,
  anxious: 0.2,
  sad: 0.1,
  angry: 0.0
}

export interface TextAnalysis {
  keywords: string[]
  mood: string
  moodScore: number
}

/**
 * Extract meaningful keywords from text
 */
export function extractKeywords(text: string): string[] {
  if (!text) return []

  // Normalize: lowercase, remove punctuation, split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2) // Skip very short words
    .filter(word => !STOP_WORDS.has(word))
    .filter(word => !/^\d+$/.test(word)) // Skip pure numbers

  // Count word frequency
  const wordCount = new Map<string, number>()
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1)
  })

  // Return unique keywords sorted by frequency
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 20) // Top 20 keywords
}

/**
 * Analyze the mood/sentiment of text
 */
export function analyzeMood(text: string): { mood: string; score: number } {
  if (!text) return { mood: 'neutral', score: 0.5 }

  const words = text.toLowerCase().split(/\s+/)
  const moodCounts: Record<string, number> = {}

  // Count mood word matches
  for (const [mood, moodWords] of Object.entries(MOOD_WORDS)) {
    moodCounts[mood] = 0
    for (const word of words) {
      if (moodWords.includes(word)) {
        moodCounts[mood]++
      }
    }
  }

  // Find dominant mood
  let dominantMood = 'reflective'
  let maxCount = 0

  for (const [mood, count] of Object.entries(moodCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominantMood = mood
    }
  }

  return {
    mood: dominantMood,
    score: MOOD_SCORES[dominantMood] ?? 0.5
  }
}

/**
 * Analyze text for both keywords and mood
 */
export function analyzeText(text: string): TextAnalysis {
  const keywords = extractKeywords(text)
  const { mood, score } = analyzeMood(text)

  return {
    keywords,
    mood,
    moodScore: score
  }
}

/**
 * Calculate similarity between two notes based on shared keywords
 * Returns a value between 0 and 1
 */
export function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const set1 = new Set(keywords1)
  const sharedKeywords = keywords2.filter(k => set1.has(k))

  // Jaccard similarity coefficient
  const union = new Set([...keywords1, ...keywords2])
  return sharedKeywords.length / union.size
}

/**
 * Get shared keywords between two keyword arrays
 */
export function getSharedKeywords(keywords1: string[], keywords2: string[]): string[] {
  const set1 = new Set(keywords1)
  return keywords2.filter(k => set1.has(k))
}

/**
 * Calculate mood similarity between two mood scores
 * Returns a value between 0 and 1
 */
export function calculateMoodSimilarity(score1: number, score2: number): number {
  return 1 - Math.abs(score1 - score2)
}

/**
 * Calculate overall connection strength between two notes
 * Combines keyword similarity and mood similarity
 */
export function calculateConnectionStrength(
  text1: string,
  text2: string
): { strength: number; sharedKeywords: string[]; mood1: string; mood2: string } {
  const analysis1 = analyzeText(text1)
  const analysis2 = analyzeText(text2)

  const keywordSim = calculateKeywordSimilarity(analysis1.keywords, analysis2.keywords)
  const moodSim = calculateMoodSimilarity(analysis1.moodScore, analysis2.moodScore)
  const sharedKeywords = getSharedKeywords(analysis1.keywords, analysis2.keywords)

  // Weight keywords more heavily than mood (70/30)
  const strength = keywordSim * 0.7 + moodSim * 0.3

  return {
    strength,
    sharedKeywords,
    mood1: analysis1.mood,
    mood2: analysis2.mood
  }
}
