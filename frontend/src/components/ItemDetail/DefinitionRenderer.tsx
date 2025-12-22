import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Anchor, ActionIcon, useMantineColorScheme } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { SpeakWord, GetItemImage, GetEnvVars } from '../../../wailsjs/go/main/App.js'
import { LogInfo, LogError } from '../../../wailsjs/runtime/runtime.js'
import { Network, Volume2, Copy } from 'lucide-react'
import { stripPossessive, REFERENCE_COLOR_MAP } from '../../utils/references'
import { PoemRenderer } from './PoemRenderer'
import { Patterns } from '../../utils/constants'

const COLOR_MAP = REFERENCE_COLOR_MAP

import { useQuery } from '@tanstack/react-query'

function ReferenceLink({ matchedItem, displayWord, color, hasQuotedText, stopAudio, currentAudioRef, parentItem }: any) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  
  const { data: envVars } = useQuery({
    queryKey: ['envVars'],
    queryFn: GetEnvVars,
  })

  useEffect(() => {
    // LogInfo(`[ReferenceLink] Checking item: ${matchedItem.word}, Type: ${matchedItem.type}, ID: ${matchedItem.itemId}`)
    if (matchedItem.type === 'Writer') {
      // LogInfo(`[ReferenceLink] Fetching image for Writer: ${matchedItem.word} (ID: ${matchedItem.itemId})`)
      GetItemImage(matchedItem.itemId).then(img => {
        if (img && img.length > 0) {
          // LogInfo(`[ReferenceLink] Found image for ${matchedItem.word}`)
          setImageUrl(img)
        // } else {
          // LogInfo(`[ReferenceLink] No image found for ${matchedItem.word}`)
        }
      // }).catch(err => {
        // LogError(`[ReferenceLink] Error fetching image for ${matchedItem.word}: ${err}`)
      })
    } else {
      // Log if we have a writer but the type doesn't match 'Writer' exactly
      // This helps debug if the type is 'writer' or something else
      if (matchedItem.type.toLowerCase() === 'writer' && matchedItem.type !== 'Writer') {
        //  LogInfo(`[ReferenceLink] Type mismatch for ${matchedItem.word}: Expected 'Writer', got '${matchedItem.type}'`)
      }
    }
  }, [matchedItem.itemId, matchedItem.type])

  // Check if this link is part of a "Written by:" line in a Title item
  // We want to hide the thumbnail in this specific context because the main image already shows the writer
  const isWrittenByLine = parentItem?.type === 'Title' && 
                          parentItem?.definition?.includes(`Written by: {writer: ${matchedItem.word}}`)

  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <Anchor
        component={Link}
        to={`/item/${matchedItem.itemId}?tab=detail`}
        onClick={(e: React.MouseEvent) => {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
          }
        }}
        style={{ 
          color,
          fontWeight: 600,
          textDecoration: 'underline',
          fontVariant: 'small-caps'
        }}
      >
        {displayWord}
      </Anchor>

      {imageUrl && !isWrittenByLine && (
        <Anchor
          component={Link}
          to={`/item/${matchedItem.itemId}?tab=detail`}
          style={{ 
            marginLeft: '6px',
            display: 'inline-block',
            verticalAlign: 'middle',
            lineHeight: 0
          }}
        >
          <img 
            src={imageUrl} 
            alt={displayWord}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid var(--mantine-color-default-border)'
            }}
          />
        </Anchor>
      )}

      <Anchor
        component={Link}
        to={`/item/${matchedItem.itemId}?tab=graph`}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation()
        }}
        style={{ 
          marginLeft: '6px',
          display: 'inline-block',
          verticalAlign: 'middle',
          opacity: 0.6
        }}
        title="Show in graph"
      >
        <Network size={14} />
      </Anchor>

      {hasQuotedText && (
        <>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="green"
            style={{ 
              marginLeft: '6px',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
            title={envVars?.['OPENAI_API_KEY'] ? "Read quoted text" : "Configure OpenAI API Key in Settings to enable TTS"}
            disabled={!envVars?.['OPENAI_API_KEY']}
            onClick={async (e: React.MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              
              stopAudio()
              
              const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/
              const match = matchedItem.definition.match(quoteRegex)
              if (!match || !match[1]) {
                notifications.show({
                  title: 'No Quote Found',
                  message: 'Could not find quoted text',
                  color: 'orange',
                })
                return
              }
              
              let quotedText = match[1].replace(/[\\\/]$/gm, '').trim()
              const wordCount = quotedText.split(/\s+/).length
              
              if (wordCount < 500) {
                if (quotedText.length > 4000) {
                  quotedText = quotedText.substring(0, 4000)
                }
              } else {
                const stanzas = quotedText.split(/\n\s*\n/)
                let selectedText = stanzas[0] || ''
                let lineCount = selectedText.split('\n').length
                let stanzaIndex = 1
                while (lineCount < 5 && stanzaIndex < stanzas.length) {
                  const nextStanza = stanzas[stanzaIndex]
                  const combined = selectedText + '\n\n' + nextStanza
                  if (combined.length > 4000) break
                  selectedText = combined
                  lineCount = selectedText.split('\n').length
                  stanzaIndex++
                }
                quotedText = selectedText.trim()
              }
              
              const textToSpeak = `${matchedItem.word}. ${quotedText}`
              const finalText = textToSpeak.length > 4000 
                ? textToSpeak.substring(0, 4000) 
                : textToSpeak
              
              notifications.show({
                id: 'tts-inline-loading',
                title: 'Generating speech...',
                message: 'Querying OpenAI',
                color: 'blue',
                loading: true,
                autoClose: false,
              })
              
              try {
                const result = await SpeakWord(finalText, parentItem?.type || '', parentItem?.word || '')
                LogInfo(`Received inline TTS result, cached: ${result.cached}, error: ${result.error || 'none'}`)
                
                if (result.error) {
                  notifications.update({
                    id: 'tts-inline-loading',
                    title: 'TTS Error',
                    message: result.error,
                    color: 'red',
                    loading: false,
                    autoClose: result.errorType === 'missing_key' ? false : 5000,
                    withCloseButton: true,
                  })
                  return
                }
                
                if (result.cached) {
                  notifications.update({
                    id: 'tts-inline-loading',
                    title: 'Using cached audio',
                    message: 'Playing from cache',
                    color: 'green',
                    loading: false,
                    autoClose: 1500,
                  })
                } else {
                  notifications.hide('tts-inline-loading')
                }
                
                const audioData = result.audioData
                let uint8Array: Uint8Array
                if (typeof audioData === 'string') {
                  const binaryString = atob(audioData)
                  uint8Array = new Uint8Array(binaryString.length)
                  for (let i = 0; i < binaryString.length; i++) {
                    uint8Array[i] = binaryString.charCodeAt(i)
                  }
                } else if (audioData instanceof Uint8Array) {
                  uint8Array = audioData
                } else if (Array.isArray(audioData)) {
                  uint8Array = new Uint8Array(audioData)
                } else {
                  throw new Error('Unexpected audio data format')
                }
                
                LogInfo(`Converted inline quote to Uint8Array, length: ${uint8Array.length}`)
                const blob = new Blob([uint8Array as BlobPart], { type: 'audio/mpeg' })
                LogInfo(`Created inline quote blob, size: ${blob.size}`)
                const url = URL.createObjectURL(blob)
                const audio = new Audio(url)
                
                currentAudioRef.current = audio
                
                audio.onerror = (e) => {
                  LogError(`Inline quote audio playback error: ${JSON.stringify(e)}`)
                  notifications.show({
                    title: 'Playback Error',
                    message: 'Failed to play audio',
                    color: 'red',
                  })
                  currentAudioRef.current = null
                }
                
                await audio.play()
                LogInfo('Inline quote audio playing...')
                audio.onended = () => {
                  LogInfo('Inline quote audio playback completed')
                  URL.revokeObjectURL(url)
                  currentAudioRef.current = null
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                notifications.update({
                  id: 'tts-inline-loading',
                  title: 'Error',
                  message: errorMessage,
                  color: 'red',
                  loading: false,
                  autoClose: 3000,
                })
                LogError(`Failed to generate inline quote speech: ${error}`)
              }
            }}
          >
            <Volume2 size={16} />
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="blue"
            style={{ 
              marginLeft: '2px',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
            title="Copy quoted text"
            onClick={async (e: React.MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              
              const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/
              const match = matchedItem.definition.match(quoteRegex)
              if (match && match[1]) {
                const quotedText = match[1].replace(/[\\\/]$/gm, '').trim()
                try {
                  await navigator.clipboard.writeText(quotedText)
                  notifications.show({
                    title: 'Copied',
                    message: 'Quoted text copied to clipboard',
                    color: 'green',
                  })
                } catch (err) {
                  notifications.show({
                    title: 'Error',
                    message: 'Failed to copy text',
                    color: 'red',
                  })
                }
              } else {
                notifications.show({
                  title: 'No Quote Found',
                  message: 'Could not find quoted text',
                  color: 'orange',
                })
              }
            }}
          >
            <Copy size={14} />
          </ActionIcon>
        </>
      )}
    </span>
  )
}



interface DefinitionRendererProps {
  text: string
  allItems: any[]
  stopAudio: () => void
  currentAudioRef: React.MutableRefObject<HTMLAudioElement | null>
  item?: any
}


export function DefinitionRenderer({ text, allItems, stopAudio, currentAudioRef, item }: DefinitionRendererProps) {
  const { colorScheme } = useMantineColorScheme()

  // Check if this is a Poem (Title type + exactly one pair of brackets)
  // We replicate the strict IsPoem logic from backend
  const isPoem = item?.type === 'Title' && 
                 (text.match(/\[/g) || []).length === 1 && 
                 (text.match(/\]/g) || []).length === 1;

  // Helper to process text for links (moved up to be accessible)
  const renderTextWithLinks = (segmentText: string, startKey: number | string) => {
    const parts: React.ReactElement[] = []
    // Create new regex instance to avoid shared state issues with lastIndex
    const regex = new RegExp(Patterns.ReferenceTag)
    let lastIndex = 0
    let match
    let keyCounter = 0

    while ((match = regex.exec(segmentText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${startKey}-${keyCounter++}`}>{segmentText.substring(lastIndex, match.index)}</span>)
      }

      const refType = match[1].toLowerCase()
      const refWord = match[2].trim()
      const displayWord = refWord // Keep original for display
      const matchWord = refType === 'writer' ? stripPossessive(refWord) : refWord
      const color = COLOR_MAP[refType] || '#000'

      const matchedItem = allItems?.find(
        (item: any) => item.word.toLowerCase() === matchWord.toLowerCase()
      )

      if (matchedItem) {
        const hasQuotedText = matchedItem.type === 'Title' && matchedItem.definition && /\[\s*\n/.test(matchedItem.definition)
        
        parts.push(
          <ReferenceLink
            key={`link-${startKey}-${keyCounter++}`}
            matchedItem={matchedItem}
            displayWord={displayWord}
            color={color}
            hasQuotedText={hasQuotedText}
            stopAudio={stopAudio}
            currentAudioRef={currentAudioRef}
            parentItem={item}
          />
        )
      } else {
        parts.push(
          <span key={`missing-${startKey}-${keyCounter++}`} style={{ color: '#999', fontStyle: 'italic', fontWeight: 600, fontVariant: 'small-caps' }}>
            {displayWord}
          </span>
        )
      }

      lastIndex = regex.lastIndex
    }

    // Add remaining text
    if (lastIndex < segmentText.length) {
      parts.push(<span key={`text-${startKey}-${keyCounter++}`}>{segmentText.substring(lastIndex)}</span>)
    }

    return parts
  }

  if (isPoem) {
    // Extract content between brackets, capturing text before and after
    const match = text.match(/^([\s\S]*?)\[([\s\S]*)\]([\s\S]*)$/);
    if (match) {
      const preText = match[1];
      const content = match[2].trim();
      const postText = match[3];
      
      return (
        <>
          {preText && preText.trim().length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {renderTextWithLinks(preText, 'pre-poem')}
            </div>
          )}
          <PoemRenderer 
            content={content} 
            renderLine={(line, i) => (
              <>{renderTextWithLinks(line, `line-${i}`)}</>
            )}
          />
          {postText && postText.trim().length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              {renderTextWithLinks(postText, 'post-poem')}
            </div>
          )}
        </>
      );
    }
  }
  
  // First, split by block quotes (text between [ and ])
  const blockQuoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/g
  const segments: Array<{ type: 'text' | 'quote', content: string }> = []
  let lastIdx = 0
  let blockMatch
  
  while ((blockMatch = blockQuoteRegex.exec(text)) !== null) {
    // Add text before the quote
    if (blockMatch.index > lastIdx) {
      segments.push({ type: 'text', content: text.substring(lastIdx, blockMatch.index) })
    }
    // Add the quote content (without the brackets), stripping trailing \ or / from each line
    const quoteContent = blockMatch[1].replace(/[\\\/]$/gm, '')
    segments.push({ type: 'quote', content: quoteContent })
    lastIdx = blockQuoteRegex.lastIndex
  }
  
  // Add remaining text
  if (lastIdx < text.length) {
    segments.push({ type: 'text', content: text.substring(lastIdx) })
  }
  
  // Now process each segment for reference links
  const processTextForLinks = (segmentText: string, startKey: number) => {
    const parts: React.ReactElement[] = []
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    let lastIndex = 0
    let match
    let key = startKey

    while ((match = regex.exec(segmentText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${key++}`}>{segmentText.substring(lastIndex, match.index)}</span>)
      }

      const refType = match[1].toLowerCase()
      const refWord = match[2].trim()
      const displayWord = refWord // Keep original for display (may include 's)
      // Strip possessive 's from writer references for matching
      const matchWord = refType === 'writer' ? stripPossessive(refWord) : refWord
      const color = COLOR_MAP[refType] || '#000'

      // Find matching item - case insensitive match on word
      const matchedItem = allItems?.find(
        (item: any) => item.word.toLowerCase() === matchWord.toLowerCase()
      )

      if (matchedItem) {
        // Check if this is a Title with quoted text
        const hasQuotedText = matchedItem.type === 'Title' && matchedItem.definition && /\[\s*\n/.test(matchedItem.definition)
        
        parts.push(
          <ReferenceLink
            key={`linkgroup-${key++}`}
            matchedItem={matchedItem}
            displayWord={displayWord}
            color={color}
            hasQuotedText={hasQuotedText}
            stopAudio={stopAudio}
            currentAudioRef={currentAudioRef}
            parentItem={item}
          />
        )
        /*
            <Anchor
              component={Link}
              to={`/item/${matchedItem.itemId}?tab=graph`}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
              }}
              style={{ 
                marginLeft: '6px',
                display: 'inline-block',
                verticalAlign: 'middle',
                opacity: 0.6
              }}
              title="Show in graph"
            >
              <Network size={14} />
            </Anchor>
            {hasQuotedText && (
              <>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="green"
                  style={{ 
                    marginLeft: '6px',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                  title={envVars?.['OPENAI_API_KEY'] ? "Read quoted text" : "Configure OpenAI API Key in Settings to enable TTS"}
                  disabled={!envVars?.['OPENAI_API_KEY']}
                  onClick={async (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    
                    // Stop any currently playing audio
                    stopAudio()
                    
                    // Extract quoted text from definition
                    const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/
                    const match = matchedItem.definition.match(quoteRegex)
                    if (!match || !match[1]) {
                      notifications.show({
                        title: 'No Quote Found',
                        message: 'Could not find quoted text',
                        color: 'orange',
                      })
                      return
                    }
                    
                    // Strip trailing \ or / from each line
                    let quotedText = match[1].replace(/[\\\/]$/gm, '').trim()
                    
                    // Count words in entire poem
                    const wordCount = quotedText.split(/\s+/).length
                    
                    // If entire poem is less than 500 words, read it all
                    if (wordCount < 500) {
                      // Keep full text, just limit to 4000 chars if needed
                      if (quotedText.length > 4000) {
                        quotedText = quotedText.substring(0, 4000)
                      }
                    } else {
                      // Split into stanzas (separated by empty lines)
                      const stanzas = quotedText.split(/\n\s*\n/)
                      
                      // Start with first stanza
                      let selectedText = stanzas[0] || ''
                      let lineCount = selectedText.split('\n').length
                      
                      // If first stanza has less than 5 lines, add more stanzas
                      let stanzaIndex = 1
                      while (lineCount < 5 && stanzaIndex < stanzas.length) {
                        const nextStanza = stanzas[stanzaIndex]
                        const combined = selectedText + '\n\n' + nextStanza
                        
                        // Make sure we don't exceed 4000 chars
                        if (combined.length > 4000) break
                        
                        selectedText = combined
                        lineCount = selectedText.split('\n').length
                        stanzaIndex++
                      }
                      
                      quotedText = selectedText.trim()
                    }
                    
                    // Prepend the title
                    const textToSpeak = `${matchedItem.word}. ${quotedText}`
                    
                    // Final safety check: ensure we don't exceed 4000 chars
                    const finalText = textToSpeak.length > 4000 
                      ? textToSpeak.substring(0, 4000) 
                      : textToSpeak
                    
                    notifications.show({
                      id: 'tts-inline-loading',
                      title: 'Generating speech...',
                      message: 'Querying OpenAI',
                      color: 'blue',
                      loading: true,
                      autoClose: false,
                    })
                    
                    try {
                      const result = await SpeakWord(finalText, '', '')
                      LogInfo(`Received inline TTS result, cached: ${result.cached}, error: ${result.error || 'none'}`)
                      
                      // Check for errors
                      if (result.error) {
                        notifications.update({
                          id: 'tts-inline-loading',
                          title: 'TTS Error',
                          message: result.error,
                          color: 'red',
                          loading: false,
                          autoClose: result.errorType === 'missing_key' ? false : 5000,
                          withCloseButton: true,
                        })
                        return
                      }
                      
                      // Show cache indicator
                      if (result.cached) {
                        notifications.update({
                          id: 'tts-inline-loading',
                          title: 'Using cached audio',
                          message: 'Playing from cache',
                          color: 'green',
                          loading: false,
                          autoClose: 1500,
                        })
                      } else {
                        notifications.hide('tts-inline-loading')
                      }
                      
                      const audioData = result.audioData
                      
                      // Decode base64 string to binary
                      let uint8Array: Uint8Array
                      if (typeof audioData === 'string') {
                        const binaryString = atob(audioData)
                        uint8Array = new Uint8Array(binaryString.length)
                        for (let i = 0; i < binaryString.length; i++) {
                          uint8Array[i] = binaryString.charCodeAt(i)
                        }
                      } else if (audioData instanceof Uint8Array) {
                        uint8Array = audioData
                      } else if (Array.isArray(audioData)) {
                        uint8Array = new Uint8Array(audioData)
                      } else {
                        throw new Error('Unexpected audio data format')
                      }
                      
                      LogInfo(`Converted inline quote to Uint8Array, length: ${uint8Array.length}`)
                      const blob = new Blob([uint8Array as BlobPart], { type: 'audio/mpeg' })
                      LogInfo(`Created inline quote blob, size: ${blob.size}`)
                      const url = URL.createObjectURL(blob)
                      const audio = new Audio(url)
                      
                      // Store reference to current audio
                      currentAudioRef.current = audio
                      
                      audio.onerror = (e) => {
                        LogError(`Inline quote audio playback error: ${JSON.stringify(e)}`)
                        notifications.show({
                          title: 'Playback Error',
                          message: 'Failed to play audio',
                          color: 'red',
                        })
                        currentAudioRef.current = null
                      }
                      
                      await audio.play()
                      LogInfo('Inline quote audio playing...')
                      audio.onended = () => {
                        LogInfo('Inline quote audio playback completed')
                        URL.revokeObjectURL(url)
                        currentAudioRef.current = null
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : String(error)
                      notifications.update({
                        id: 'tts-inline-loading',
                        title: 'Error',
                        message: errorMessage,
                        color: 'red',
                        loading: false,
                        autoClose: 3000,
                      })
                      LogError(`Failed to generate inline quote speech: ${error}`)
                    }
                  }}
                >
                  <Volume2 size={16} />
                </ActionIcon>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="blue"
                  style={{ 
                    marginLeft: '2px',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                  title="Copy quoted text"
                  onClick={async (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    
                    // Extract quoted text from definition
                    const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/
                    const match = matchedItem.definition.match(quoteRegex)
                    if (match && match[1]) {
                      const quotedText = match[1].replace(/[\\\/]$/gm, '').trim()
                      try {
                        await navigator.clipboard.writeText(quotedText)
                        notifications.show({
                          title: 'Copied',
                          message: 'Quoted text copied to clipboard',
                          color: 'green',
                        })
                      } catch (err) {
                        notifications.show({
                          title: 'Error',
                          message: 'Failed to copy text',
                          color: 'red',
                        })
                      }
                    } else {
                      notifications.show({
                        title: 'No Quote Found',
                        message: 'Could not find quoted text',
                        color: 'orange',
                      })
                    }
                  }}
                >
                  <Copy size={14} />
                </ActionIcon>
              </>
      */
      } else {
        // No match found - show in gray italic (not as a link)
        parts.push(
          <span key={`missing-${key++}`} style={{ color: '#999', fontStyle: 'italic', fontWeight: 600, fontVariant: 'small-caps' }}>
            {displayWord}
          </span>
        )
      }

      lastIndex = regex.lastIndex
    }

    // Add remaining text
    if (lastIndex < segmentText.length) {
      parts.push(<span key={`text-${key++}`}>{segmentText.substring(lastIndex)}</span>)
    }

    return { parts, nextKey: key }
  }
  
  // Render all segments
  const finalParts: React.ReactElement[] = []
  let globalKey = 0
  
  segments.forEach((segment, idx) => {
    if (segment.type === 'quote') {
      // Check if this is a poem: Type is Title AND exactly one quote segment in the whole definition
      const isPoem = item?.type === 'Title' && segments.filter(s => s.type === 'quote').length === 1

      if (isPoem) {
        finalParts.push(
          <PoemRenderer
            key={`poem-${idx}`}
            content={segment.content}
            renderLine={(line, _lineIdx) => {
              const { parts } = processTextForLinks(line, globalKey)
              globalKey += parts.length
              return <>{parts}</>
            }}
          />
        )
      } else {
        const { parts } = processTextForLinks(segment.content, globalKey)
        globalKey += parts.length
        finalParts.push(
          <div
            key={`quote-${idx}`}
            style={{
              margin: '1rem 0',
              padding: '0.75rem 1rem',
              borderLeft: `4px solid ${colorScheme === 'dark' ? '#666' : '#ccc'}`,
              backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5',
              fontStyle: 'italic',
              color: colorScheme === 'dark' ? '#d4d4d4' : '#555',
            }}
          >
            {parts}
          </div>
        )
      }
    } else {
      const { parts, nextKey } = processTextForLinks(segment.content, globalKey)
      globalKey = nextKey
      finalParts.push(...parts)
    }
  })

  return <>{finalParts}</>
}
