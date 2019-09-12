# mirror-directories

## Usage

### Example 1
Recursively copy all the directories matching the glob `src/*` to `out1` and `out2`:

```bash
% mirror-directories -s 'src/*' -d out1 -d out2
```

If `src/project1` and `src/project2` exist then they will be copied to `out1/project1`, `out1/project2`, `out2/project1` and `out2/project2`.

Existing contents of the destination directories will be erased before the copying occurs such that the destination directories will mirror the source directories exactly.

### Example 2

Recursively copy `src1` and `src2` to all the directories matching `destinations/*`:

```bash
% mirror-directories -s src1 -s src2 -d 'destinations/*'
```

If `src1/cat`, `src2/dog` and `src2/friend`, `destinations/birthday` and `destinations/fear` exist then at the end `destinations/{birthday,fear}/{cat,dog,friend}` will be exact copies of the respective files in `src1` and `src2`.

## API

This library also exports an API:

```typescript
import { mirrorDirectories } from 'mirror-directories'

mirrorDirectories([
  ['src1', ['dest1', 'dest2']],
  ['src2', ['dest2', 'dest3']],
])
```
