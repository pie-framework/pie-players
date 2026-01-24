# Math.js Calculator Provider - Issues Found

## Critical Issues:

### 1. **Memory Leak - Keyboard Event Listener**
**Location:** Lines 404, 676
**Issue:** Keyboard event listener is added but not properly removed
- `document.addEventListener('keydown', this._handleKeyboard.bind(this))` - Creates NEW bound function
- `document.removeEventListener('keydown', this._handleKeyboard)` - Removes DIFFERENT function reference
- This causes memory leak - listener never removed!

**Fix:** Store bound function reference

### 2. **Button Event Listeners Not Cleaned Up**
**Location:** Lines 384-401
**Issue:** Button click listeners are added but never removed in destroy()
- Multiple calculator instances will accumulate event listeners
- Memory leak on repeated create/destroy cycles

**Fix:** Store button references and remove listeners in destroy()

### 3. **Keyboard Handler Not Checking Calculator Focus**
**Location:** Lines 471-493
**Issue:** Keyboard handler checks `document.activeElement` but calculator may not have focus
- Should only respond when calculator container or child elements are focused
- Currently can interfere with other inputs on page

**Fix:** Better focus detection

### 4. **Multiple Style Tags**
**Location:** Line 377
**Issue:** Each calculator instance appends a `<style>` tag
- Multiple instances = duplicate styles in DOM
- Not cleaned up in destroy()

**Fix:** Single shared style or cleanup in destroy()

### 5. **History Display Overflow**
**Location:** Scientific calculator history display
**Issue:** History only shows in temporary display area
- No persistent history view
- User can't see past calculations

**Fix:** Consider adding history panel (optional enhancement)

## Medium Priority Issues:

### 6. **No Error Recovery**
**Location:** Line 549-555
**Issue:** Calculation error just shows "Error" - no context
- User doesn't know what went wrong
- No way to recover except clear

**Fix:** More descriptive error messages

### 7. **No Input Validation**
**Location:** Division by zero, invalid operations
**Issue:** Math.js will throw errors for some operations
- No graceful handling

**Fix:** Validate before evaluation

### 8. **Theme Stored But Not Used After Init**
**Location:** Line 115, 273
**Issue:** Theme is set on init but not reactive
- Can't change theme after creation
- Window matchMedia not monitored for changes

**Fix:** Make theme reactive (optional)

## Low Priority / Enhancements:

### 9. **No Decimal Point Validation**
**Issue:** User can enter multiple decimal points (1.2.3)
**Fix:** Validate decimal point input

### 10. **No Max Expression Length**
**Issue:** Very long expressions could cause display issues
**Fix:** Add max length check

### 11. **No Parentheses Balance**
**Issue:** User can enter unbalanced parentheses
**Fix:** Track and validate balance

### 12. **Scientific Calculator Missing Functions**
**Issue:** No inverse trig, hyperbolic functions, factorial, etc.
**Fix:** Add more scientific functions (future)
