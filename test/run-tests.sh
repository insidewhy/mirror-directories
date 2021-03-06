#!/usr/bin/env bash

die() {
  echo $1
  exit 1
}

kill_watcher() {
  if [ -n "$watcher_pid" ] ; then
    kill $watcher_pid
    unset watcher_pid
  fi
}
trap kill_watcher exit

rm -rf srcs out*

ensure_match() {
  [ -d $1 ] || die "output directory $1 was not created"
  diff -r $1 $2 || die "directories $1 and $2 differ"
}

ensure_path_does_not_exist() {
  [ ! -e $1 ] || die "path $1 should not exist"
}

ensure_all_matches() {
  ensure_match out1/project1 srcs/project1
  ensure_match out1/project2 srcs/project2
  ensure_match out2/project1 srcs/project1
  ensure_match out2/project2 srcs/project2
}

setup_standard_test_files() {
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
}

standard_tests() {
  echo running standard tests
  setup_standard_test_files

  ../bin/mirror-directories -v -s 'srcs/*' -d out1 -d out2 || die 'mirror-directories failed'

  ensure_all_matches
  echo standard tests passed
}

standard_tests_with_m_arg() {
  echo "standard tests using -m argument"
  setup_standard_test_files
  rm -rf out*
  ../bin/mirror-directories -v -m srcs/project1:out1 -m srcs/project2/:out2/friend || die 'mirror-directories failed'
  ensure_match out1/project1 srcs/project1
  ensure_match out2/friend srcs/project2
}

watch_tests() {
  echo running watch tests
  setup_standard_test_files

  # add some files to the output directories to ensure they are removed
  touch out1/project1/dir1/should-not-exist-out1-dir1
  touch out2/project1/dir1/should-not-exist-out2-dir1

  ../bin/mirror-directories -w -v -s 'srcs/*' -d out1 -d out2 &
  watcher_pid=$!
  sleep 1

  echo making changes to srcs
  # create new file
  touch srcs/project2/dir/new-file
  # remove some files
  rm srcs/project1/root-a
  rm srcs/project2/dir/files-g
  # # alter a file
  echo new-line >> srcs/project1/root-b
  sleep 1

  ensure_all_matches
  kill_watcher
}

rename_tests() {
  echo running rename tests
  mkdir -p srcs/oldname/subdir
  touch srcs/oldname/file
  touch srcs/oldname/subdir/subdir-files{1,2,3}

  ../bin/mirror-directories -v -s srcs/oldname/ -d out3
  ensure_match out3/subdir srcs/oldname/subdir
  diff out3/file srcs/oldname/file || die "files in root directory differ"

  # echo running watch rename tests
  ../bin/mirror-directories -w -v -s srcs/oldname/ -d out3 &
  watcher_pid=$!
  sleep 1

  # change stuff in the renamed directory
  rm srcs/oldname/subdir/subdir-files2
  echo stuff >> srcs/oldname/subdir/subdir-files3
  sleep 1

  ensure_match out3/subdir srcs/oldname/subdir
  diff out3/file srcs/oldname/file || die "files in root directory differ"
  kill_watcher
}

ensure_multi_content() {
  local f1=srcs/$1/$2
  local f2=out-multi/$2
  diff srcs/$1/$2 out-multi/$2 || die "$f1 and $f2 should not differ"
}

setup_multi_rename_sources() {
  mkdir -p srcs/{multi1,multi2}
  echo multi1-only > srcs/multi1/multi1-only
  echo multi2-only > srcs/multi2/multi2-only
  echo multi1-blah > srcs/multi1/blah
  echo multi2-blah > srcs/multi2/blah
  rm -rf multi-out
  mkdir multi-out
}

rename_tests_with_multiple_sources() {
  echo running rename tests with multiple sources
  setup_multi_rename_sources

  ../bin/mirror-directories -v -m srcs/multi1/:srcs/multi2/:out-multi

  ensure_multi_content multi1 multi1-only
  ensure_multi_content multi2 multi2-only
  ensure_multi_content multi2 blah
}

rename_tests_with_multiple_sources_watch() {
  echo running rename tests with multiple sources
  setup_multi_rename_sources

  ../bin/mirror-directories -w -v -m srcs/multi1/:srcs/multi2/:out-multi &
  watcher_pid=$!
  sleep 1

  ensure_multi_content multi1 multi1-only
  ensure_multi_content multi2 multi2-only
  ensure_multi_content multi2 blah

  echo new-multi2-content >> srcs/multi2/blah
  sleep 1
  ensure_multi_content multi2 blah

  # should not update blah when it changes in multi1 since multi2 should override it
  echo new-multi1-content >> srcs/multi1/blah
  sleep 1
  ensure_multi_content multi2 blah

  # should not remove blah when it is removed from multi1 due to precedence
  rm srcs/multi1/blah
  sleep 1
  ensure_multi_content multi2 blah

  # after deleting the multi2 copy of blah the output will mirror the multi1 copy
  echo newer-multi1-content > srcs/multi1/blah
  rm srcs/multi2/blah
  sleep 1
  ensure_multi_content multi1 blah

  # and keep mirroring it
  echo newest-multi1-content > srcs/multi1/blah
  sleep 1
  ensure_multi_content multi1 blah
  kill_watcher
}

setup_exclude_sources() {
  mkdir -p srcs/project-ex/{include,exclude}
  touch srcs/project-ex/{include,exclude}/something
}

exclude_tests() {
  setup_exclude_sources
  ../bin/mirror-directories -v -e exclude -m srcs/project-ex/:out-ex
  rm -rf srcs/project-ex/exclude
  ensure_match srcs/project-ex out-ex
}

exclude_tests_watch() {
  setup_exclude_sources
  ../bin/mirror-directories -w -v -e exclude -m srcs/project-ex/:out-ex &
  watcher_pid=$!
  sleep 1
  ensure_match srcs/project-ex/include out-ex/include
  ensure_path_does_not_exist out-ex/exclude

  touch srcs/project-ex/exclude/other
  touch srcs/project-ex/include/other
  sleep 1
  ensure_match srcs/project-ex/include out-ex/include
  ensure_path_does_not_exist out-ex/exclude

  kill_watcher
  rm -rf srcs/project-ex/exclude
  ensure_match srcs/project-ex out-ex
}

standard_tests
standard_tests_with_m_arg
watch_tests
rename_tests
rename_tests_with_multiple_sources
rename_tests_with_multiple_sources_watch
exclude_tests
exclude_tests_watch
echo all tests passed
