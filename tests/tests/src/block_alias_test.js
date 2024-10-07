// Generated by ReScript, PLEASE EDIT WITH CARE
'use strict';

let Mt = require("./mt.js");
let Belt_List = require("rescript/lib/js/belt_List.js");
let Primitive_object = require("rescript/lib/js/primitive_object.js");

let suites = {
  contents: /* [] */0
};

let test_id = {
  contents: 0
};

function eq(loc, x, y) {
  Mt.eq_suites(test_id, suites, loc, x, y);
}

function b(loc, x) {
  Mt.bool_suites(test_id, suites, loc, x);
}

let Block = {};

let v0 = {
  TAG: "A",
  _0: 0,
  _1: 1
};

let Block$1 = {};

let v1 = {
  TAG: "A",
  _0: 0,
  _1: 1
};

let N = {
  Block: Block$1,
  v1: v1
};

let Caml_obj = {};

let List = {};

let V = {
  List: List
};

let f = Primitive_object.equal;

eq("File \"block_alias_test.res\", line 27, characters 3-10", Belt_List.length({
  hd: 1,
  tl: {
    hd: 2,
    tl: /* [] */0
  }
}), 2);

b("File \"block_alias_test.res\", line 28, characters 2-9", Primitive_object.equal(v0, {
  TAG: "A",
  _0: 0,
  _1: 1
}));

eq("File \"block_alias_test.res\", line 29, characters 3-10", v0, v1);

Mt.from_pair_suites("Block_alias_test", suites.contents);

let h = Belt_List.length;

exports.suites = suites;
exports.test_id = test_id;
exports.eq = eq;
exports.b = b;
exports.Block = Block;
exports.v0 = v0;
exports.N = N;
exports.Caml_obj = Caml_obj;
exports.V = V;
exports.f = f;
exports.h = h;
/*  Not a pure module */