// Generated by ReScript, PLEASE EDIT WITH CARE

import * as Mt from "./mt.mjs";

let suites = {
  contents: /* [] */0
};

let test_id = {
  contents: 0
};

function eq(loc, x, y) {
  Mt.eq_suites(test_id, suites, loc, x, y);
}

let X = {};

function xx(obj, a0, a1, a2, a3, a4, a5) {
  return (a4(a2(a0(obj, a1), a3), a5) - 1 | 0) - 3 | 0;
}

eq("File \"gpr_3536_test.res\", line 18, characters 12-19", 5, 5);

eq("File \"gpr_3536_test.res\", line 20, characters 12-19", xx(3, (prim0, prim1) => prim0 - prim1 | 0, 2, (prim0, prim1) => prim0 + prim1 | 0, 4, (prim0, prim1) => Math.imul(prim0, prim1), 3), 11);

Mt.from_pair_suites("Gpr_3536_test", suites.contents);

let v = 5;

let u = {
  TAG: "Some",
  _0: 3
};

export {
  suites,
  test_id,
  eq,
  v,
  X,
  u,
  xx,
}
/*  Not a pure module */