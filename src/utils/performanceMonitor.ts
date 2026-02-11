/** 
 * Performance monitor for mobile devices.
 * Detects slow devices and disables heavy animations.
 */

export function isLowEndDevice(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  
  // Check device memory (if available)
  const deviceMemory = (navigator as any).deviceMemory
  const isLowMemory = deviceMemory && deviceMemory < 4
  
  // Check connection speed
  const connection = (navigator as any).connection
  const isSlowConnection = connection && (connection.effectiveType === '3g' || connection.effectiveType === '4g' && connection.downlink < 1)
  
  return (isIOS && isSafari) || isLowMemory || isSlowConnection || false
}

export function disableHeavyAnimations() {
  if (isLowEndDevice()) {
    // Add class to root element to disable animations via CSS
    document.documentElement.classList.add('reduce-animations')
    
    // Disable Framer Motion via environment variable
    ;(window as any).__FRAMER_MOTION_DISABLE_ANIMATIONS = true
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Initialize on load
if (typeof window !== 'undefined') {
  disableHeavyAnimations()
}
