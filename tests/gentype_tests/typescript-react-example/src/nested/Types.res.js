// Generated by ReScript, PLEASE EDIT WITH CARE

import * as Belt_List from "rescript/lib/es6/belt_List.js";
import * as Belt_Option from "rescript/lib/es6/belt_Option.js";

function swap(tree) {
  return {
    label: tree.label,
    left: Belt_Option.map(tree.right, swap),
    right: Belt_Option.map(tree.left, swap)
  };
}

function selfRecursiveConverter(param) {
  return param.self;
}

function mutuallyRecursiveConverter(param) {
  return param.b;
}

function testFunctionOnOptionsAsArgument(a, foo) {
  return foo(a);
}

function jsonStringify(prim) {
  return JSON.stringify(prim);
}

function testConvertNull(x) {
  return x;
}

function testConvertLocation(x) {
  return x;
}

let testMarshalFields = {
  _rec: "rec",
  _switch: "_switch",
  switch: "switch",
  __: "__",
  ___: "_",
  foo__: "foo",
  _foo__: "_foo",
  _Uppercase: "Uppercase",
  _Uppercase__: "_Uppercase"
};

function setMatch(x) {
  x._match = 34;
}

function testInstantiateTypeParameter(x) {
  return x;
}

let currentTime = new Date();

let optFunction = () => 3;

let ObjectId = {};

let someIntList = {
  hd: 1,
  tl: {
    hd: 2,
    tl: {
      hd: 3,
      tl: /* [] */0
    }
  }
};

let map = Belt_List.map;

let stringT = "a";

let jsStringT = "a";

let jsString2T = "a";

export {
  someIntList,
  map,
  swap,
  selfRecursiveConverter,
  mutuallyRecursiveConverter,
  testFunctionOnOptionsAsArgument,
  stringT,
  jsStringT,
  jsString2T,
  jsonStringify,
  testConvertNull,
  testConvertLocation,
  testMarshalFields,
  setMatch,
  testInstantiateTypeParameter,
  currentTime,
  optFunction,
  ObjectId,
}
/* currentTime Not a pure module */