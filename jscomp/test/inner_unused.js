'use strict';


function f(x) {
  return x + 3 | 0;
}

function M(S) {
  var f = function (x) {
    return x;
  };
  return {
          f
        };
}

function fff(param, param$1) {
  return 3;
}

exports.f = f;
exports.M = M;
exports.fff = fff;
/* No side effect */
