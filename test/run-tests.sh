#!/bin/sh

die() {
  echo $1
  exit 1
}

rm -rf srcs out1 out2

mkdir -p srcs/project1/{dir1,dir2}
mkdir -p srcs/project1/dir1/{subdir-1-1,subdir-1-2}
mkdir -p srcs/project1/dir2/{subdir-2-1,subdir-2-2}
mkdir -p srcs/project2
mkdir -p srcs/project2/dir

# create source directory trees
touch srcs/project1/dir1/subdir-1-1/{file-1-1-1,file-1-1-2}
touch srcs/project1/dir1/subdir-1-2/{file-1-2-1,file-1-2-2}
touch srcs/project1/dir2/subdir-2-1/{file-2-1-1,file-2-1-2}
touch srcs/project1/dir2/subdir-2-2/{file-2-2-1,file-2-2-2}
touch srcs/project1/dir1/{file-1-1,file-1-2}
touch srcs/project1/dir2/{file-2-1,file-2-2}
touch srcs/project1/root-{a,b,c}
touch srcs/project2/root-{d,e,f}
touch srcs/project2/dir/files-{g,h,i}

# create output directory trees and add some files to them so we
# can make sure the mirror deletes them
mkdir -p out1/project1/{dir1,dir2}
mkdir -p out1/project1/dir1/subdir-1-1
mkdir -p out1/project2/dir
touch out1/project1/dir{1,2}/should-not-exist
touch out1/project1/dir1/subdir-1-1/also-should-not-exist
touch out1/project2/{nowhere,neverwhere}
touch out1/project2/dir/{could-not,should-not}

mkdir -p out2

../bin/mirror-directories -v -s 'srcs/*' -d out1 -d out2 || die 'mirror-directories failed'

ensure_match() {
  [ -d $2 ] || die "output directory $2 was not created"
  diff -r $1 $2 || die "directories $1 and $2 differ"
}

ensure_match out1/project1 srcs/project1
ensure_match out1/project2 srcs/project2
ensure_match out2/project1 srcs/project1
ensure_match out2/project2 srcs/project2

echo all tests passed
