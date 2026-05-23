# Performance Testing Guide

## How to Test the Performance Improvements

### 1. Test Lazy Loading

**Chrome DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Reload the gallery page
4. **Expected**: Only ~12-20 image requests initially (not all 50+)
5. Scroll down slowly
6. **Expected**: More images load as you scroll

**Visual Test:**
- Top images should load immediately
- Bottom images should show loading placeholder
- As you scroll, placeholders turn into images

---

### 2. Test Network Speed Adaptation

**Chrome DevTools:**
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Reload gallery page
4. **Expected**: Fewer images load initially (12-16 instead of 20)
5. Check console for network quality detection

**Test Different Speeds:**
- **Fast 3G**: Should load 16 images
- **Slow 3G**: Should load 12 images
- **No throttling**: Should load 20 images

---

### 3. Test WebP/AVIF Format

**Chrome DevTools:**
1. Open DevTools → Network tab
2. Load a gallery
3. Click on any image request
4. Check "Response Headers"
5. **Expected**: `Content-Type: image/webp` or `image/avif`

**Safari Test:**
- Should serve WebP (Safari 16.4+)
- Older Safari: JPEG fallback

**Visual Check:**
- Images should look identical to before
- File sizes should be smaller (check Network tab)

---

### 4. Test Infinite Scroll

**Steps:**
1. Open gallery with 50+ images
2. Count images visible initially (~12-20)
3. Scroll to bottom
4. **Expected**: "Loading more images..." appears
5. More images load automatically
6. Repeat until all images loaded

**Memory Test:**
- Open DevTools → Memory → Take heap snapshot
- Scroll through entire gallery
- Take another snapshot
- **Expected**: Memory should stabilize, not keep growing

---

### 5. Test Blur Placeholders

**Steps:**
1. Clear cache (Ctrl+Shift+Delete)
2. Set Network throttling to "Slow 3G"
3. Load gallery
4. **Expected**: Tiny blurred versions appear instantly
5. Full images fade in gradually

**Visual:**
- Should see blur → sharp transition
- No layout shifts or jumps
- Smooth progressive loading

---

### 6. Test Lightbox Quality

**Critical Test:**
1. Open any image in lightbox
2. Zoom in to pixel level
3. **Expected**: Full resolution, maximum quality
4. No pixelation or compression artifacts

**Check Network Request:**
- URL should have `size=full`
- File size: 5-10MB (large, full quality)
- Format: AVIF or WebP (but high quality setting)

---

### 7. Test Smart Preloading

**Fast Connection:**
1. Set Network to "No throttling"
2. Hover over an image (don't click)
3. Open Network tab
4. **Expected**: Full-size image starts downloading

**Slow Connection:**
1. Set Network to "Slow 3G"
2. Hover over an image
3. Open Network tab
4. **Expected**: No download triggered (preloading disabled)

---

### 8. Mobile Device Testing

**Real Device Test:**
1. Deploy to Vercel or run locally
2. Access from iPhone/Android
3. Test on 4G → airplane mode → WiFi

**Expected Behavior:**
- **Fast WiFi**: All features, 20 images
- **4G**: Standard load, 16-20 images
- **Slow connection**: Reduced quality, 12 images
- **Offline**: Previously loaded images cached

---

## Performance Metrics

### Lighthouse Test (Chrome DevTools)

1. Open DevTools → Lighthouse
2. Select "Performance" and "Mobile"
3. Run audit

**Expected Scores:**
- Performance: 85-95 (was 50-70)
- LCP: < 2.5s (was 8s)
- CLS: < 0.1 (was 0.18)
- FID: < 100ms

---

## Network Simulation Tests

### Test Matrix

| Throttling | Expected Initial Load | Expected Image Size | Format |
|------------|----------------------|---------------------|--------|
| No throttling | 20 images | 400px | AVIF |
| Fast 3G | 16 images | 400px | WebP |
| Slow 3G | 12 images | 400px | WebP |
| Offline | 0 new images | Cached only | N/A |

---

## Browser Compatibility Tests

### Required Tests

✅ **Chrome**: Full features (AVIF, lazy load, network detection)
✅ **Safari 16.4+**: WebP, lazy load (no network API)
✅ **Firefox**: WebP, lazy load
✅ **Safari < 16**: JPEG fallback, lazy load
✅ **Old browsers**: All images load immediately with JPEG

---

## Data Usage Comparison

### Before vs After (50 image gallery)

**Test Setup:**
1. Clear cache
2. Open DevTools → Network
3. Load gallery page
4. Note "transferred" size at bottom

**Expected Results:**

| Scenario | Before | After |
|----------|--------|-------|
| Initial page load | 15-20MB | 4-6MB |
| View 5 lightbox images | +25MB | +8MB (WebP) |
| Full gallery scroll | 20-25MB | 8-12MB |

---

## Troubleshooting

### Images Not Loading?

**Check:**
1. Google Drive credentials set in `.env.local`
2. Folder IDs configured
3. Service account has access to folders
4. Network tab for error messages

### WebP Not Serving?

**Check:**
1. Browser supports WebP (not IE11)
2. Response header shows `Content-Type: image/webp`
3. Sharp installed: `npm list sharp`

### Lazy Loading Not Working?

**Check:**
1. Scroll position (images must be near viewport)
2. Console for errors
3. Intersection Observer supported (all modern browsers)

### Infinite Scroll Stuck?

**Check:**
1. Gallery has more than initial load count images
2. Scroll to bottom (sentinel element)
3. Console for JavaScript errors

---

## Quick Visual Test Checklist

- [ ] Blur placeholders appear instantly
- [ ] Images fade in smoothly
- [ ] No layout shifts while loading
- [ ] Lightbox images are sharp and high quality
- [ ] Infinite scroll loads more on scroll
- [ ] Loading spinner appears when fetching more
- [ ] Network slow = fewer initial images
- [ ] Hover on fast network = preloads full image
- [ ] File sizes smaller in Network tab
- [ ] Memory usage stable (not growing)

---

## Expected Results Summary

### Initial Load (50 images, Fast WiFi)
```
Time    Event
0ms     HTML/CSS loaded
200ms   Blur placeholders visible
800ms   First 6 images sharp
2s      All 20 initial images loaded
```

### Initial Load (50 images, Slow 3G)
```
Time    Event
0ms     HTML/CSS loaded
500ms   Blur placeholders visible
5s      First 6 images sharp
12s     All 12 initial images loaded
```

### Lightbox Open
```
Time    Event
0ms     Click image
50ms    Lightbox opens with thumbnail
200ms   Progressive: low quality full-size
800ms   Progressive: medium quality
2s      Final: maximum quality sharp
```

---

## Performance Reports

After testing, you should see:

**Network Tab:**
- Fewer simultaneous requests
- Smaller file sizes (WebP/AVIF)
- Progressive loading pattern

**Memory Tab:**
- Stable memory usage
- No continuous growth
- Garbage collection working

**Lighthouse:**
- Green scores (90+)
- Fast LCP
- Low CLS
- Good FID

If any of these aren't happening, there may be an issue to investigate!
