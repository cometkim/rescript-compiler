// Generated by ReScript, PLEASE EDIT WITH CARE
'use strict';

let Curry = require("../../lib/js/curry.js");

function g(x) {
  return Curry._1(x, x);
}

let loop = g(g);

exports.g = g;
exports.loop = loop;
/* loop Not a pure module */
