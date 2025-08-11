# Testing Position Mapping Implementation

## Test Scenarios

### 1. Basic Analysis Without Concurrent Edits
1. Open a transcript file
2. Select a text block in the sidebar
3. Click "Analyze Text Block"
4. Verify that analysis runs without locking the editor
5. Verify suggestions are created as diff nodes

### 2. Analysis With Concurrent Edits
1. Open a transcript file
2. Select a text block in the sidebar
3. Click "Analyze Text Block"
4. **While analysis is running**, make edits elsewhere in the document:
   - Add text before the analyzed segment
   - Delete text before the analyzed segment
   - Modify text after the analyzed segment
5. Verify that suggestions are still applied at the correct positions
6. Check console logs for position reconciliation messages

### 3. Text Matching Fallback
1. Open a transcript file
2. Select a text block
3. Start analysis
4. Make significant edits that change positions dramatically
5. Verify that the system falls back to text search
6. Check console for fallback messages

### 4. Multiple Rapid Analyses
1. Open a transcript file
2. Quickly analyze multiple segments in succession
3. Edit the document between analyses
4. Verify all suggestions are applied correctly

## Expected Behavior

### Visual Feedback
- ✅ No editor locking overlay appears
- ✅ Blue info banner shows "Analyzing segment... You can continue editing"
- ✅ Editor remains fully interactive during analysis

### Console Output
Look for these messages in browser console:

1. **Document version capture:**
   ```
   📸 Captured document version: {id: "v_...", timestamp: ..., transactionCount: ...}
   ```

2. **Position reconciliation (when positions change):**
   ```
   📍 Reconciled positions: [100, 150] → [125, 175]
   ```

3. **Position-based diff creation:**
   ```
   Using reconciled positions [125, 175] for diff creation
   ```

4. **Fallback to text search (when needed):**
   ```
   Position reconciliation failed, falling back to text search
   No positions available, using text search for diff creation
   ```

## Technical Verification

### Check Services
In browser console, verify services are initialized:
```javascript
// Check if reconciliation service is active
$editor = document.querySelector('.editor-content').__svelte__.editor
mapper = getPositionMapper($editor)
mapper.getVersion() // Should return current version

// Check reconciliation service
reconciliationService = getReconciliationService($editor)
reconciliationService.getPendingEditsSummary() // Should show pending edits
```

### Monitor Position Mapping
```javascript
// Watch position mapping in action
mapper.recordTransaction(tr) // Automatically called on each edit
mapper.mapPosition(100) // Maps old position to new
mapper.mapRange(100, 200) // Maps a range
```

## Success Criteria

1. **User Experience**
   - ✅ User can continue editing during analysis
   - ✅ No interruption to workflow
   - ✅ Smooth, responsive editor

2. **Technical Accuracy**
   - ✅ Suggestions applied at correct positions even after edits
   - ✅ Position reconciliation works correctly
   - ✅ Text search fallback functions when needed

3. **Performance**
   - ✅ No noticeable lag during analysis
   - ✅ Position mapping is fast
   - ✅ Memory usage remains stable

## Troubleshooting

### Issue: Suggestions applied at wrong positions
- Check console for reconciliation errors
- Verify document version is captured correctly
- Check if text has changed too much for reconciliation

### Issue: Reconciliation service not working
- Ensure service is initialized when editor is set
- Check that transactions are being recorded
- Verify position mapper is tracking changes

### Issue: Performance degradation
- Check if too many pending edits are accumulating
- Verify periodic reconciliation is running
- Monitor memory usage for leaks