import { useState, useEffect } from 'react'
import { useMantineColorScheme } from '@mantine/core'

export default function useDarkMode() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const [isDark, setIsDark] = useState(colorScheme === 'dark')

  useEffect(() => {
    setIsDark(colorScheme === 'dark')
  }, [colorScheme])

  const toggle = () => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
  }

  return { isDark, toggle }
}
