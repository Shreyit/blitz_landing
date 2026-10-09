# Rive export contract

Place your owned/licensed `blitz.riv` here. Set:

```env
NEXT_PUBLIC_RIVE_SRC=/animations/blitz.riv
NEXT_PUBLIC_RIVE_STATE_MACHINE=Guide
```

The `Guide` state machine can expose a numeric `step` input: 0 = identity, 1 = sports/photo, 2 = review. The component updates this input as the form advances, resizes the canvas, and disposes the runtime on unmount. Reduced motion and asset/runtime failure preserve the static lightning guide.

No custom binary artwork has been supplied. The Three.js mascot is original code-native art and works independently of this export. For deployment, consider hosting the official Rive JS/WASM runtime locally rather than using the adapter’s pinned CDN loader.
