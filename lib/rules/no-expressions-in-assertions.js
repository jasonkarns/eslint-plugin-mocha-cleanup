/**
 * @fileoverview Rule to detect expressions in the `expect` and `assert` assertions
 * @author onechiporenko
 * @copyright 2015 onechiporenko. All rights reserved.
 */

"use strict";

var n = require("../utils/node.js");
var obj = require("../utils/obj.js");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = function (context) {
  var insideIt = false;
  var options = context.options[0] || {};
  var skipSkipped = options.hasOwnProperty("skipSkipped") ? options.skipSkipped : false;
  var nodeSkipped;

  var defaultMessage = "Expression should not be used here.";
  var detailedMessage = "`{{shouldUse}}` should be used.";

  var typesToReportAsDefault = ["ConditionalExpression", "UnaryExpression", "LogicalExpression", "UpdateExpression"];

  var binaryMapForExpect = {
    "===": ".to.be.equal",
    "!==": ".to.be.not.equal",
    "==": ".to.be.equal",
    "!=": ".to.be.not.equal",
    ">=": ".to.be.at.least",
    ">": ".to.be.above",
    "<=": ".to.be.most",
    "<": ".to.be.below",
    "instanceof": ".to.be.instanceof"
  };

  var binaryMapForAssert = {
    "===": ".strictEqual",
    "!==": ".notStrictEqual",
    "==": ".equal",
    "!=": ".notEqual",
    ">=": ".isAtLeast",
    ">": ".isAbove",
    "<=": ".isAtMost",
    "<": ".isBelow"
  };

  /**
   *
   * @param {ASTNode} binaryExpression
   * @param {ASTNode} node
   * @returns {*}
   */
  function checkBinaryInExpect(binaryExpression, node) {
    var eqls = ["===", "==", "!==", "!="];
    var op = binaryExpression.operator;
    var shouldUse = binaryMapForExpect[op];
    if (shouldUse) {
      if (eqls.indexOf(op) === -1) {
        return context.report(node, detailedMessage, {shouldUse: shouldUse});
      }
      var primitives = [null, true, false];
      for (var i = 0; i < primitives.length; i++) {
        if (checkForValueInExpect(binaryExpression, op, node, primitives[i])) {
          return;
        }
      }

      if (checkForUndefinedInExpect(binaryExpression, op, node)) {
        return;
      }
      return context.report(node, detailedMessage, {shouldUse: shouldUse});
    }
    return context.report(node, defaultMessage);
  }

  /**
   *
   * @param {ASTNode} binaryExpression
   * @param {string} op '=='|'==='|'!='|'!=='
   * @param {ASTNode} node
   * @param {*} value
   * @returns {boolean}
   */
  function checkForValueInExpect(binaryExpression, op, node, value) {
    var shouldUse = ".to." + (op[0] === "!" ? "not." : "") + "be." + value;
    if (obj.get(binaryExpression, "left.value") === value || obj.get(binaryExpression, "right.value") === value) {
      context.report(node, detailedMessage, {shouldUse: shouldUse});
      return true;
    }
    return false;
  }

  /**
   *
   * @param {ASTNode} binaryExpression
   * @param {string} op '=='|'==='|'!='|'!=='
   * @param {ASTNode} node
   * @returns {boolean}
   */
  function checkForUndefinedInExpect(binaryExpression, op, node) {
    var shouldUse = ".to." + (op[0] === "!" ? "not." : "") + "be.undefined";
    if (obj.get(binaryExpression, "left.name") === "undefined" || obj.get(binaryExpression, "right.name") === "undefined") {
      context.report(node, detailedMessage, {shouldUse: shouldUse});
      return true;
    }
    return false;
  }

  /**
   *
   * @param {ASTNode} binaryExpression
   * @param {ASTNode} node
   */
  function checkBinaryInAssert(binaryExpression, node) {
    var eqls = ["===", "==", "!==", "!="];
    var op = binaryExpression.operator;
    var shouldUse = binaryMapForAssert[op];
    if (shouldUse) {
      if (eqls.indexOf(op) === -1) {
        return context.report(node, detailedMessage, {shouldUse: shouldUse});
      }
      var primitives = [null, true, false];
      for (var i = 0; i < primitives.length; i++) {
        if (checkForValueAssert(binaryExpression, op, node, primitives[i])) {
          return;
        }
      }

      if (checkForUndefinedAssert(binaryExpression, op, node)) {
        return;
      }
      return context.report(node, detailedMessage, {shouldUse: shouldUse});
    }
    return context.report(node, defaultMessage);
  }

  /**
   *
   * @param {ASTNode} binaryExpression
   * @param {string} op '=='|'==='|'!='|'!=='
   * @param {ASTNode} node
   * @param {*} value
   * @returns {boolean}
   */
  function checkForValueAssert(binaryExpression, op, node, value) {
    var _value = "" + value;
    var shouldUse = ".is" + (op[0] === "!" ? "Not" : "") + _value.charAt(0).toUpperCase() + _value.slice(1);
    if (obj.get(binaryExpression, "left.value") === value || obj.get(binaryExpression, "right.value") === value) {
      context.report(node, detailedMessage, {shouldUse: shouldUse});
      return true;
    }
    return false;
  }

  /**
   *
   * @param {ASTNode} binaryExpression
   * @param {string} op '=='|'==='|'!='|'!=='
   * @param {ASTNode} node
   * @returns {boolean}
   */
  function checkForUndefinedAssert(binaryExpression, op, node) {
    var shouldUse = op[0] === "!" ? ".isUndefined" : ".isDefined";
    if (obj.get(binaryExpression, "left.name") === "undefined" || obj.get(binaryExpression, "right.name") === "undefined") {
      context.report(node, detailedMessage, {shouldUse: shouldUse});
      return true;
    }
    return false;
  }

  return {
    "FunctionExpression": function (node) {
      if (n.isTestBody(node)) {
        if (skipSkipped) {
          nodeSkipped = n.tryDetectSkipInParent(node);
        }
        insideIt = true;
      }
    },
    "FunctionExpression:exit": function (node) {
      if (n.isTestBody(node)) {
        insideIt = false;
        nodeSkipped = false;
      }
    },
    "CallExpression": function (node) {
      if (!insideIt || nodeSkipped) {
        return;
      }
      var arg;
      if (n.isChaiExpect(node)) {
        arg = obj.get(node, "arguments.0");
        if (arg.type === "BinaryExpression") {
          return checkBinaryInExpect(arg, node);
        }
        if (typesToReportAsDefault.indexOf(arg.type) !== -1) {
          return context.report(node, defaultMessage);
        }
      }
    },
    "MemberExpression": function (node) {
      if (!insideIt || nodeSkipped) {
        return;
      }
      var arg;
      if (n.isChaiAssert(node)) {
        arg = obj.get(node, "parent.arguments.0");
        if (arg.type === "BinaryExpression") {
          return checkBinaryInAssert(arg, node);
        }
        if (typesToReportAsDefault.indexOf(arg.type) !== -1) {
          return context.report(node, defaultMessage);
        }
      }
    }
  };
};

module.exports.schema = [
  {
    type: "object",
    properties: {
      skipSkipped: {
        type: "boolean"
      }
    },
    additionalProperties: false
  }
];