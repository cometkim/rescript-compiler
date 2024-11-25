// Generated by ReScript, PLEASE EDIT WITH CARE

import * as Mt from "./mt.mjs";
import * as Belt_MutableMapInt from "rescript/lib/es6/Belt_MutableMapInt.js";

let suites = {
  contents: /* [] */0
};

let test_id = {
  contents: 0
};

function eq(loc, x, y) {
  Mt.eq_suites(test_id, suites, loc, x, y);
}

let mockMap = Belt_MutableMapInt.make();

function add(id) {
  Belt_MutableMapInt.set(mockMap, id, id);
  return id;
}

function remove(id) {
  Belt_MutableMapInt.remove(mockMap, id);
}

add(1726);

let n = add(6667);

add(486);

Belt_MutableMapInt.remove(mockMap, 1726);

let n1 = Belt_MutableMapInt.getExn(mockMap, 6667);

eq("File \"gpr_4265_test.res\", line 18, characters 3-10", n, n1);

Mt.from_pair_suites("gpr_4265_test.res", suites.contents);

export {
  suites,
  test_id,
  eq,
  mockMap,
  add,
  remove,
  n,
  n1,
}
/* mockMap Not a pure module */