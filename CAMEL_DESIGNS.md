# Camel Shape Design Options

Choose one of these 5 designs. I'll update the code with your choice.

## Design 1: Simple Rounded Profile
**Best for:** Clean, minimal look with clear stacking

```
Simple body with single rounded hump
- Smooth curves throughout
- Wide base for stability
- Clear head and neck
- Single prominent hump
```

SVG Path:
```javascript
const CAMEL_D = 
  'M 5,30 L 5,24 ' +
  'C 5,20 8,16 12,14 ' +
  'C 15,12 18,8 20,6 ' +
  'C 22,4 25,4 27,6 ' +
  'C 29,8 30,12 30,16 ' +
  'L 31,12 C 32,8 36,7 38,10 ' +
  'C 40,13 39,18 37,20 ' +
  'L 36,24 L 36,30 L 32,30 L 32,24 ' +
  'L 25,24 L 25,30 L 21,30 L 21,24 ' +
  'L 14,24 L 14,30 Z';
```

## Design 2: Two-Hump Bactrian Camel
**Best for:** Distinctive look with two humps

```
Two-humped camel profile
- Clear dual humps
- Lower middle section
- Better visual variety
- Still stackable
```

SVG Path:
```javascript
const CAMEL_D =
  'M 4,30 L 4,24 ' +
  'C 4,20 6,17 10,15 ' +
  'C 12,13 14,10 15,8 ' +
  'C 16,6 18,5 20,7 ' +
  'C 21,9 22,12 22,15 ' +
  'L 23,13 C 24,10 26,9 28,11 ' +
  'C 29,13 29,16 28,18 ' +
  'L 30,14 C 31,11 34,11 36,14 ' +
  'C 37,17 36,20 34,22 ' +
  'L 35,26 L 35,30 L 31,30 L 31,26 ' +
  'L 24,26 L 24,30 L 20,30 L 20,26 ' +
  'L 13,26 L 13,30 Z';
```

## Design 3: Stylized Modern Camel
**Best for:** Contemporary game aesthetic

```
Geometric-inspired design
- Angular hump
- Straight neck line
- Modern proportions
- Flat bottom for stacking
```

SVG Path:
```javascript
const CAMEL_D =
  'M 3,30 L 3,26 L 8,24 ' +
  'L 12,22 L 15,18 ' +
  'L 17,12 L 20,8 ' +
  'L 23,6 L 26,8 ' +
  'L 28,14 L 29,18 ' +
  'L 31,14 L 33,10 ' +
  'L 36,10 L 38,14 ' +
  'L 37,18 L 35,22 ' +
  'L 36,24 L 36,26 L 36,30 ' +
  'L 32,30 L 32,26 ' +
  'L 25,26 L 25,30 L 21,30 L 21,26 ' +
  'L 14,26 L 14,30 Z';
```

## Design 4: Classic Camel Silhouette
**Best for:** Traditional board game feel

```
Classic camel profile
- Defined neck curve
- Single arch hump
- Realistic proportions
- Four legs visible
```

SVG Path:
```javascript
const CAMEL_D =
  'M 6,30 L 6,25 ' +
  'C 6,22 8,19 11,17 ' +
  'C 13,15 15,12 17,9 ' +
  'C 18,6 21,4 24,5 ' +
  'C 26,6 28,9 29,13 ' +
  'C 30,16 30,20 29,22 ' +
  'L 31,16 C 32,12 35,11 37,13 ' +
  'C 39,15 39,19 37,22 ' +
  'C 36,23 35,24 35,25 ' +
  'L 35,30 L 31,30 L 31,25 ' +
  'L 26,25 L 26,30 L 22,30 L 22,25 ' +
  'L 17,25 L 17,30 L 13,30 L 13,25 ' +
  'L 10,26 L 6,30 Z';
```

## Design 5: Puzzle-Piece Camel (Best for Stacking)
**Best for:** Optimal interlocking like physical pieces

```
Designed specifically for stacking
- Deep concave bottom (receives hump from below)
- Prominent rounded hump (fits into above)
- Interlocking geometry
- Physical piece aesthetic
```

SVG Path:
```javascript
const CAMEL_D =
  'M 2,30 ' +
  'C 4,28 7,26 10,25 ' +  // Concave bottom left
  'L 12,24 L 14,26 ' +     // Left leg
  'L 16,24 ' +              // Saddle dip
  'L 18,26 L 20,24 ' +     // Middle legs
  'L 22,26 L 24,24 ' +
  'L 26,21 ' +              // Body rise
  'C 27,18 28,14 28,11 ' + // Neck
  'L 29,8 C 30,5 32,4 34,6 ' + // Head
  'C 35,8 35,11 34,13 ' +  // Hump peak
  'L 35,16 C 36,19 36,22 35,24 ' + // Back slope
  'L 36,26 L 36,30 ' +     // Right leg
  'L 32,30 L 32,26 ' +
  'L 26,26 L 26,30 L 22,30 L 22,26 ' +
  'L 16,26 L 16,30 L 12,30 L 12,26 ' +
  'L 8,28 ' +               // Bottom curve
  'C 6,29 4,30 2,30 Z';
```

---

**Please reply with your choice (1, 2, 3, 4, or 5) and I'll update the camel shape in the code!**

Each design has different characteristics:
- **Design 1**: Simplest, cleanest
- **Design 2**: Most distinctive (two humps)
- **Design 3**: Most modern/geometric
- **Design 4**: Most realistic
- **Design 5**: Best for actual stacking (recommended)
