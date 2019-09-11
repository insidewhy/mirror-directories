# ts-purify

## Motivation

When compiling typescript files in `src` to an output directory in `lib` with `tsc`, the `js` files already existing in `lib` are left alone, potentially interfering with the build system and tests.

`ts-purify` deletes all `js` and `js.map` files in the output directory with no corresponding `ts` files when it is run. It can also be configured to watch the source directory for deletions and then delete corresponding output files as they occur.

## Instructions

To recursively delete all `js` and `js.map` files in `lib` with no corresponding `ts` file in `src`:

```bash
% ts-purify -s src -d lib
```

To do the same as the above command, then use `watchman` to scan `src` for deleted `ts` files and remove files from `lib` as necessary:

```bash
% ts-purify -s src -d lib -w
```

These invocations show the defaults for `-s` and `-l`, they can be omitted when also using `src` and `lib` respectively.

The `-v` or `--verbose` option can be used to log deleted files.

In most cases `package.json` `scripts` will just need to be modified from something like:
```json
{
  "build:watch": "tsc -p . -w"
}
```

To:
```json
{
  "build:watch": "ts-purify -w & tsc -p . -w"
}
```

To support Windows, use `concurrently` instead of `&`:
```json
{
  "build:watch": "concurrently \"ts-purify -w\" \"tsc -p . -w\""
}
```
