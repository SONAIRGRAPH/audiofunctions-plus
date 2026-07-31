import { create, all, re, e } from 'mathjs'

const config = { }
const math = create(all, config)
let errorMessage = null; // this will be used to store error messages
let errorPosition = null; // position of the error message; 0 for regular functions, an array showing positions for a piecewise function

// function to update errorMessage
function updateErrorMessage(message) {
    errorMessage = errorMessage != null ? errorMessage + ", " + message : message;
}

// function to check if 'expr' is a constant, for instance, -1 or 10+2
export function isMathConstant(expr){
    try{
        math.compile(expr).evaluate() // when trying to evaluate without scope, if not a constant, throws error
        return math.isNumeric(math.compile(expr).evaluate()); // we check if the result is a number
    }
    catch(ex){
        return false;
    }
}

// detects if expr is an expression of a function in one variable or a constant, for instance, "sin(x)+x^2" or "2"
function isOneVariableFunction(expr){
    const allowed_fn = ["sin", "ceil", "floor", "cos", "tan", "exp", "log", "sqrt", "abs", "exp", "ln", "log10", "log2", "asin", "acos", "atan", "sinh", "cosh", "tanh","cot","acot","nthroot"];
    const fn_with_more_args = ["log", "nthroot"]; // functions that can have one or two arguments
    // WARNING nthroot is not implemented in mathjs, we need nthRoot
    const allowed_constants = ["PI","pi","e","E"];
    const allowed_op = ["+", "-", "*", "/", "^"];
    function removeItemAll(arr, value) {
        var i = 0;
        while (i < arr.length) {
            if (arr[i] === value) {
            arr.splice(i, 1);
            } else {
            ++i;
            }
        }
        return arr;
    }
    if (expr.length==0){
        updateErrorMessage("Empty expression");
        return false;
    }
    try{
        const parsed = math.parse(expr); // we parse the input string
        if ("items" in parsed){ // an array
            updateErrorMessage("Not a valid function (array)");
            return false;
        }
        if ("blocks" in parsed){ // an array
            updateErrorMessage("Multiple expressions not allowed (;)");
            return false;
        }
        let snodes = [... new Set(parsed.filter((n) => n.isSymbolNode))]; // symbol nodes this includes functions and variables
        const fnNodes = [... new Set(parsed.filter((n) => n.isFunctionNode))]; // function nodes
        const opNodes = [... new Set(parsed.filter((n) => n.isOperatorNode))]; // operator nodes
        //console.log(snodes.map((n) => n.name));
        //console.log("fn ",fnNodes.map((n) => n.name));
        //console.log("op ",opNodes.map((n) => n.op));
        // if (!(fnNodes.every((n) => n.args.length==1 && allowed_fn.includes(n.name)))){
        //     console.log("Invalid function or wrong number of arguments");
        //     return false;
        // }
        for (let i=0;i<fnNodes.length;i++){
            if (!(allowed_fn.includes(fnNodes[i].name))){
                updateErrorMessage("Invalid function name: " + fnNodes[i].name);
                errorPosition = 0;
                //console.log("Invalid function name: ", fnNodes[i].name);
                return false;
            }
            if (fnNodes[i].args.length!=1 && !(fn_with_more_args.includes(fnNodes[i].name))){
                updateErrorMessage("Invalid function, wrong number of arguments: " + fnNodes[i].name);
                errorPosition = 0;
                //console.log("Invalid function, wrong number of arguments: ", fnNodes[i].name);
                return false;
            }
            if (fn_with_more_args.includes(fnNodes[i].name) && fnNodes[i].args.length>2){
                updateErrorMessage("Function " + fnNodes[i].name + " should have at most two arguments");
                errorPosition = 0;
                //console.log("This function should have at most two arguments: ", fnNodes[i].name);
                return false;
            }
        }
        if (!(opNodes.every((n) => allowed_op.includes(n.op)))){
            updateErrorMessage("Invalid operator");
            errorPosition = 0;
            //console.log("Invalid operator");
            return false;
        }
        parsed.traverse(function (node, path, parent) { // we have checked all functions, we remove them from the list of symbol nodes
            if (node.isSymbolNode && parent?.name == node.name && allowed_fn.includes(node.name)){
                removeItemAll(snodes,node);
                //console.log(node.name);
            }
        });
        //console.log(snodes.map((n) => n.name));
        // the remaining should be a single variable "x" or a constant
        if (snodes.every((n) => allowed_constants.includes(n.name) || n.name=="x")){
            return true;
        } else {
            updateErrorMessage("Invalid expression for a function of one variable");
            errorPosition = 0;
            return false;
        }
    }
    catch(ex){
        // console.log("Not a valid function")
        updateErrorMessage("Invalid or incomplete expression");
        errorPosition = 0;
        return false;
    }
}

// function to check if 'expr' is a valid math expression
// that is, passes the math parser
function isValidMathParse(expr){
    try{
        //math.parse(expr); this is not enough, since several variables can be involved
        const parsed = math.parse(expr); // we parse the string txt
        // if (!("items" in parsed)){ // not a piecewise function
        //     // if(typeof math.compile(expr).evaluate({x:0})=='number'){ // this parses and checks the expression at 0, if more variables are involved, an error is thrown
        //     // return true;
        //     // }else{
        //     //     return false;
        //     // }
        //     return isOneVariableFunction(expr); // we check if the expression is a function of one variable
        // }
        return true;
    }
    catch(ex){
        updateErrorMessage("Invalid math expression ");
        errorPosition = 0; // this must be changed later
        return false;
    }

}


// we are allowing conditions of the form x=a; we translate them into x==a
export function transformAssingnments(node) {
  return node.transform(function (node, path, parent) {
    if (node.type=='AssignmentNode') {
      return new math.OperatorNode('==','equal',[node.object, node.value]);
    }
    else {
      return node
    }
  })
}


// pi -> math.pi, math.e, E -> math.e; jessicode does not understand these constants
export function transformMathConstants(node) {
  return node.transform(function (node, path, parent) {
    if (node.type=='SymbolNode') {
        switch (node.name) {
            case 'pi':
                return new math.ConstantNode(math.pi);
            case 'PI':
                return new math.ConstantNode(math.pi);
            case 'e':
                return new math.ConstantNode(math.e);
            case 'E':
                return new math.ConstantNode(math.e);
            default:
                return node;
        }
    }
    else {
      return node
    }
  })
}

// checks if txt is an assignment, for instance, y=x^2+1 or f(x)=x^2+1
function isAssignment(txt){
    // we first check that the input is a valid math expression
    if (!(isValidMathParse(txt))){
        return false;
    }
    const parsed = math.parse(txt); // we parse the string txt
    return parsed.type == "AssignmentNode" || parsed.type == "FunctionAssignmentNode";
}

// returns the expression of an assignment, for instance, y=x^2+1 returns x^2+1
// if the input is not an assignment, returns the input string
function getAssignmentExpression(txt){
    if (!isAssignment(txt)){
        return txt;
    }
    const parsed = math.parse(txt); // we parse the string txt
    if (parsed.type == "AssignmentNode"){
        console.log("assignment parsed.value: ", parsed.value.toString({implicit: 'show'}));
        return parsed.value.toString({implicit: 'show'});
    }
    if (parsed.type == "FunctionAssignmentNode"){
        console.log("function assignment parsed.expr: ", parsed.expr.toString({implicit: 'show'}));
        return parsed.expr.toString({implicit: 'show'});
    }
    return  "0";
}

//checks if txt describes a valid inequality: x op a, a op x with op in {<,>,<=,>=,=,==,!=}, or
// double (chains) inequalities of the form a<=x<=b, a<x<=b, a<=x<b or a<x<b
function isInequality(txt){
    // we first check that the input is a valid math expression
    if (!(isValidMathParse(txt))){
        //console.log("Invalid input: could not parse");
        return false;
    }
    const parsed = math.parse(txt); // we parse the string txt
    const ineq=transformAssingnments(parsed); // we change the assignments into equalities
    if ("op" in ineq){ //that is a single inequality or an equality
        // we check if op is ==, <, >, <=, >=
        if (ineq.op != "<" && ineq.op != ">" &&
            ineq.op != "<=" && ineq.op != ">=" &&
            ineq.op != "==" && ineq.op != "!="){
            //console.log("Invalid input, not a valid inequality (wrong relations)", ineq.toString());
            updateErrorMessage("Invalid inequality (wrong relations): " + ineq.toString());
            return false;
        }
        // we check that the number of arguments of the inequality are valid
        // this is probably not necessary, since the parser should check this
        if (ineq.args.length!=2){
            //console.log("Invalid input, not a valid inequality", ineq.toString());
            updateErrorMessage("Invalid valid inequality (wrong number of arguments): " + ineq.toString());
            return false;
        }
        // we check that the arguments of the inequality are valid
        // one must be constant and the other a variable
        const typeArgs = new Set(ineq.args.map((e)=> e.type));
        if (!typeArgs.has("SymbolNode")){ // at least one must be variable
            //console.log("Invalid input, not a valid inequality (variable needed))", ineq.toString());
            updateErrorMessage("Invalid inequality (variable needed): " + ineq.toString());
            return false;
        }
        if (ineq.args[0].type=="SymbolNode"){//equation of the form x op a
            if(ineq.args[0].name != "x"){
                updateErrorMessage("Invalid inequality (variable must be x): " + ineq.toString());
                return false;
            }
            //console.log("Variable first");
            if (!isMathConstant(ineq.args[1].toString())){
                //console.log("Invalid input, not a valid inequality (constant needed))", ineq.toString());
                updateErrorMessage("Invalid inequality (constant needed): " + ineq.toString());
                return false;
            }
            //console.log("Added interval: ", intervals[intervals.length-1].toString());
        }else{//equation of the form a op x
            //console.log("variable second")
            if(ineq.args[1].name != "x"){
                updateErrorMessage("Invalid inequality (variable must be x): " + ineq.toString());
                return false;
            }
            if (!isMathConstant(ineq.args[0].toString())){
                //console.log("Invalid input, not a valid inequality (constant needed))", ineq.toString());
                updateErrorMessage("Invalid inequality (constant needed): " + ineq.toString());
                return false;
            }
        }
        // need to check now that the other argument is constant
    }else{ // now we have a an inequality of the form a<=x<=b, a<x<=b, a<=x<b or a<x<b
        // the values a and b are the first and last arguments of the inequality
        // console.log(ineq.toString()," ",ineq.conditionals.length);
        //const keysIneq = Object.keys(ineq);
        //if (!(keysIneq[0]=="conditionals" && keysIneq[1]=="params" && keysIneq.length==2)){
        if (!(ineq.type=="RelationalNode")){
            //console.log("Invalid input, not a valid inequality", ineq.toString());
            updateErrorMessage("Invalid inequality");// + ineq.toString());
            return false;
        }
        if (!(ineq.conditionals.length==2)){
            //console.log("Invalid input, not a valid chain of inequalities (more than two)", ineq.toString());
            updateErrorMessage("Invalid chain of inequalities (more than two)"); // + ineq.toString());
            return false;
        }
        if (!ineq.conditionals.every((e)=> e=="smaller" || e=="smallerEq")){
            //console.log("Invalid input, not a valid chain of inequalities (only < and <= are allowed)", ineq.toString());
            updateErrorMessage("Invalid chain of inequalities (only < and <= are allowed)"); // + ineq.toString());
            return false;
        }
        // we check that the arguments of the inequality are valid
        // the first and third must be constant and the second a variable
        //console.log(ineq.params);
        if (!(isMathConstant(ineq.params[0].toString()) &&
                ineq.params[1].type=="SymbolNode" &&
                isMathConstant(ineq.params[2].toString()))){ // the middle parameter must be a symbol a op1 x op2 b
            //console.log("Invalid input, not a valid inequality; two constant params and a symbol", ineq.toString());
            updateErrorMessage("Invalid chain of inequalities (two constant params and a symbol in the middle) "); // + ineq.toString());
            return false;
        }
        if (ineq.params[1].name != "x"){
            updateErrorMessage("Invalid chain of inequalities (variable must be x)"); // + ineq.toString());
            return false;
        }
    }
    return true;
}

//checks if a list of conditions is compatible, that is,
//if the intervals related to these constraints are disjoint
//the argument is a list of inequalities that have been validated with isInequality
function isListOfCompatibleInequalities(cnds){
    let intervals = []; // we will store the intervals of the inequalities
    // each interval will be of the form [a,b,o1,o2] where a and b are the bounds of the interval,
    // o1 and o2 are 0 or 1 depending on if a and b are included in the interval, respectively
    // for instance, [1,2,0,1] means 1 < x <= 2
    // we will also check that the intervals are disjoint
    let partNumbers =[]; // inequalities of the form x!= a give rise to two intervals, so we keep track of the part of the function they belong to
    for (let i=0;i<cnds.length;i++){
        let cnd = math.parse(cnds[i]);
        const ineq=transformAssingnments(cnd); // we change the assignments into equalities
        // console.log(ineq.toString()+" is valid: "+isInequality(ineq.toString()));
        if (!isInequality(ineq.toString())){
            errorPosition=[[i,1]];
            return false;
        }
        if ("op" in ineq){ //that is a single inequality or an equality
            // we check if op is ==, <, >, <=, >=
            if (ineq.op != "<" && ineq.op != ">" &&
                ineq.op != "<=" && ineq.op != ">=" &&
                ineq.op != "==" && ineq.op != "!="){
                //console.log("Invalid input, not a valid inequality (wrong relations)", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid inequality (wrong relations): " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            // we check that the number of arguments of the inequality are valid
            // this is probably not necessary, since the parser should check this
            if (ineq.args.length!=2){
                //console.log("Invalid input, not a valid inequality", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid inequality (wrong number of arguments): " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            // we check that the arguments of the inequality are valid
            // one must be constant and the other a variable
            const typeArgs = new Set(ineq.args.map((e)=> e.type));
            if (!typeArgs.has("SymbolNode")){ // at least one must be variable
                //console.log("Invalid input, not a valid inequality (variable needed))", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid inequality (variable needed): " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            if (ineq.args[0].type=="SymbolNode"){//equation of the form x op a
                //console.log("Variable first");
                if (!isMathConstant(ineq.args[1].toString())){
                    //console.log("Invalid input, not a valid inequality (constant needed))", ineq.toString());
                    updateErrorMessage("Invalid piecewise format, not a valid inequality (constant needed): " + ineq.toString());
                    errorPosition = [[i,1]];
                    return false;
                }
                switch (ineq.op) {
                    case "<":
                        intervals.push([-Infinity, ineq.args[1].evaluate(), 0, 0]);
                        partNumbers.push(i);
                        break;
                    case "<=":
                        intervals.push([-Infinity, ineq.args[1].evaluate(), 0, 1]);
                        partNumbers.push(1);
                        break;
                    case ">":
                        intervals.push([ineq.args[1].evaluate(), Infinity, 0, 0]);
                        partNumbers.push(i);
                        break;
                    case ">=":
                        intervals.push([ineq.args[1].evaluate(), Infinity, 1, 0]);
                        partNumbers.push(i);
                        break;
                    case "==":
                        intervals.push([ineq.args[1].evaluate(), ineq.args[1].evaluate(), 1, 1]);
                        partNumbers.push(i);
                        break;
                    case "!=":
                        intervals.push([ineq.args[1].evaluate(), Infinity, 0, 0]);
                        partNumbers.push(i);
                        intervals.push([-Infinity, ineq.args[1].evaluate(), 0, 0]);
                        partNumbers.push(i);
                        break;
                }
                //console.log("Added interval: ", intervals[intervals.length-1].toString());
            }else{//equation of the form a op x
                //console.log("variable second")
                if (!isMathConstant(ineq.args[0].toString())){
                    //console.log("Invalid input, not a valid inequality (constant needed))", ineq.toString());
                    updateErrorMessage("Invalid piecewise format, not a valid inequality (constant needed): " + ineq.toString());
                    errorPosition = [[i,1]];
                    return false;
                }
                switch (ineq.op) {
                    case "<":
                        intervals.push([ineq.args[0].evaluate(), Infinity, 0, 0]);
                        partNumbers.push(i);
                        break;
                    case "<=":
                        intervals.push([ineq.args[0].evaluate(), Infinity, 1, 0]);
                        partNumbers.push(i);
                        break;
                    case ">":
                        intervals.push([ -Infinity,ineq.args[0].evaluate(), 0, 0]);
                        partNumbers.push(i);
                        break;
                    case ">=":
                        intervals.push([ -Infinity,ineq.args[0].evaluate(), 0, 1]);
                        partNumbers.push(i);
                        break;
                    case "==":
                        intervals.push([ineq.args[0].evaluate(), ineq.args[0].evaluate(), 1, 1]);
                        partNumbers.push(i);
                        break;
                    case "!=":
                        intervals.push([ineq.args[0].evaluate(), Infinity, 0, 0]);
                        intervals.push([-Infinity, ineq.args[0].evaluate(), 0, 0]);
                        partNumbers.push(i);
                        partNumbers.push(i);
                        break;
                }
                //console.log("Added interval: ", intervals[intervals.length-1].toString());
            }
            // need to check now that the other argument is constant
        }else{ // now we have a an inequality of the form a<=x<=b, a<x<=b, a<=x<b or a<x<b
            // the values a and b are the first and last arguments of the inequality
            // console.log(ineq.toString()," ",ineq.conditionals.length);
            //const keysIneq = Object.keys(ineq);
            //if (!(keysIneq[0]=="conditionals" && keysIneq[1]=="params" && keysIneq.length==2)){
            if (!(ineq.type=="RelationalNode")){
                //console.log("Invalid input, not a valid inequality", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid inequality: " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            if (!(ineq.conditionals.length==2)){
                //console.log("Invalid input, not a valid chain of inequalities (more than two)", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid chain of inequalities (more than two): " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            if (!ineq.conditionals.every((e)=> e=="smaller" || e=="smallerEq")){
                //console.log("Invalid input, not a valid chain of inequalities (only < and <= are allowed)", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid chain of inequalities (only < and <= are allowed): " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            // we check that the arguments of the inequality are valid
            // the first and third must be constant and the second a variable
            //console.log(ineq.params);
            if (!(isMathConstant(ineq.params[0].toString()) &&
                  ineq.params[1].type=="SymbolNode") &&
                  isMathConstant(ineq.params[2].toString())){ // the middle parameter must be a symbol a op1 x op2 b
                //console.log("Invalid input, not a valid inequality; two constant params and a symbol", ineq.toString());
                updateErrorMessage("Invalid piecewise format, not a valid inequality (two constant params and a symbol): " + ineq.toString());
                errorPosition = [[i,1]];
                return false;
            }
            if (ineq.conditionals[0]=="smallerEq" && ineq.conditionals[1]=="smallerEq"){ // a<=x<=b
                intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 1, 1]);
                partNumbers.push(i);
                //console.log("Added interval: ", intervals[intervals.length-1].toString());
            }
            if (ineq.conditionals[0]=="smaller" && ineq.conditionals[1]=="smallerEq"){ // a<x<=b
                intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 0, 1]);
                partNumbers.push(i);
                //console.log("Added interval: ", intervals[intervals.length-1].toString());
            }
            if (ineq.conditionals[0]=="smallerEq" && ineq.conditionals[1]=="smaller"){ // a<=x<b
                intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 1, 0]);
                partNumbers.push(i);
                //console.log("Added interval: ", intervals[intervals.length-1].toString());
            }
            if (ineq.conditionals[0]=="smaller" && ineq.conditionals[1]=="smaller"){ // a<x<b
                intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 0, 0]);
                partNumbers.push(i);
                //console.log("Added interval: ", intervals[intervals.length-1].toString());
            }
        }
    }
    //console.log("Intervals: ", intervals.map((e)=> e.toString()));
    // now it remains to check that the intervals are disjoint
    // first we sort the intervals by their first element
    let sortedIntervals=intervals.toSorted((a,b)=> (a[0]-b[0]==0) ? (a[1]-b[1]) : (a[0]-b[0]));
    //console.log("Intervals sorted: ", intervals.map((e)=> e.toString()));
    for (let i=0;i<intervals.length-1;i++){
        const a = sortedIntervals[i];
        const b = sortedIntervals[i+1];
        if (a[1]> b[0]){ // if the end of the first interval is greater than the start of the second interval
            //console.log("Intervals are not disjoint: ", a.toString(), b.toString());

            // Find the original indices of the overlapping intervals
            const aIndex = intervals.findIndex(interval =>
                interval[0] === a[0] && interval[1] === a[1] && interval[2] === a[2] && interval[3] === a[3]
            );
            const bIndex = intervals.findIndex((interval, idx) =>
                idx !== aIndex && interval[0] === b[0] && interval[1] === b[1] && interval[2] === b[2] && interval[3] === b[3]
            );

            // Use partNumbers to get the correct part indices
            const aPartIndex = aIndex >= 0 && aIndex < partNumbers.length ? partNumbers[aIndex] : aIndex;
            const bPartIndex = bIndex >= 0 && bIndex < partNumbers.length ? partNumbers[bIndex] : bIndex;

            // Create user-friendly error message
            updateErrorMessage(`Overlap detected between Part ${aPartIndex + 1} and Part ${bPartIndex + 1}. Please adjust the conditions to avoid overlap`);
            errorPosition = [[aPartIndex, 1], [bPartIndex, 1]]; // Both conditions have errors
            return false;
        }
        if (a[1]==b[0] && a[3]*b[2]==1){ // if the end of the first interval is equal to the start of the second interval
            //console.log("Intervals are not disjoint: ", a.toString(), b.toString());

            // Find the original indices of the overlapping intervals
            const aIndex = intervals.findIndex(interval =>
                interval[0] === a[0] && interval[1] === a[1] && interval[2] === a[2] && interval[3] === a[3]
            );
            const bIndex = intervals.findIndex((interval, idx) =>
                idx !== aIndex && interval[0] === b[0] && interval[1] === b[1] && interval[2] === b[2] && interval[3] === b[3]
            );

            // Use partNumbers to get the correct part indices
            const aPartIndex = aIndex >= 0 && aIndex < partNumbers.length ? partNumbers[aIndex] : aIndex;
            const bPartIndex = bIndex >= 0 && bIndex < partNumbers.length ? partNumbers[bIndex] : bIndex;

            // Create user-friendly error message
            updateErrorMessage(`Boundary conflict between Part ${aPartIndex + 1} and Part ${bPartIndex + 1}. Both parts include the same point. Please use < or > instead of <= or >=`);
            errorPosition = [[aPartIndex, 1], [bPartIndex, 1]]; // Both conditions have errors
            return false;
        }
    }
    return true;
}

// checks if txt is a string of the form [[expr_1,ineq_1],[expr_2,ineq_2],..,[expr_n,ineq_n]]
// where expr_i is an expression in the variable x that defines a function in the interval defined by ineq_i
// for instance [[x+5,x < -4],[x^2,-4<=x < 1],[x-2,1<=x < 3],[5,x==3],[x-2,3 < x < 5],[3,5<= x]]
// the only double (chains) inequalities allowed are of the form a<=x<=b, a<x<=b, a<=x<b or a<x<b
// legacy, and thus commented
// function isPiecewise(txt){
//     // we first check that the input is a valid math expression
//     if (!(isValidMathParse(txt))){
//         //console.log("Invalid input: could not parse");
//         return false;
//     }
//     const parsed = math.parse(txt); // we parse the string txt
//     if (!("items" in parsed)){ // not a piecewise function
//       return false;
//     }
//     const its = parsed.items; //list of items, each item should be a pair [expr,ineq]
//     if (!its.every((e)=> "items" in e)){
//         //console.log("Invalid input, not an array of arrays");
//         updateErrorMessage("Invalid piecewise format, not an array of arrays");
//         errorPosition = 0;
//         return false;
//     }
//     // so we check that all items are pairs
//     if (!its.every((e)=> e.items.length==2)){
//         //console.log("Invalid input, not a list of pairs");
//         updateErrorMessage("Invalid piecewise format, not a list of pairs");
//         errorPosition = 0;
//         return false;
//     }
//     // now we check that the first item is a function and the second is an inequality
//     let it; //single item
//     let intervals = []; // we will store the intervals of the inequalities
//     // each interval will be of the form [a,b,o1,o2] where a and b are the bounds of the interval,
//     // o1 and o2 are 0 or 1 depending on if a and b are included in the interval, respectively
//     // for instance, [1,2,0,1] means 1 < x <= 2
//     // we will also check that the intervals are disjoint
//     let partNumbers =[]; // inequalities of the form x!= a give rise to two intervals, so we keep track of the part of the function they belong to
//     for (let i=0;i<its.length;i++){
//         it=its[i]; // the ith item
//         // we check if the first item is a function in x
//         if (!(isOneVariableFunction(it.items[0].toString()))){
//             //console.log("Invalid input, not a valid function", it.items[0].toString());
//             updateErrorMessage("Invalid piecewise format, not a valid function: " + it.items[0].toString());
//             errorPosition = [[i,0]];
//             return false;
//         }
//         // now we check that the second item is an inequality
//         const ineq=transformAssingnments(it.items[1]); // we change the assignments into equalities
//         console.log(ineq.toString()+" is valid: "+isInequality(ineq.toString()));
//         if (!isInequality(ineq.toString())){
//             errorPosition=[[i,1]];
//             return false;
//         }
//         if ("op" in ineq){ //that is a single inequality or an equality
//             // we check if op is ==, <, >, <=, >=
//             if (ineq.op != "<" && ineq.op != ">" &&
//                 ineq.op != "<=" && ineq.op != ">=" &&
//                 ineq.op != "==" && ineq.op != "!="){
//                 //console.log("Invalid input, not a valid inequality (wrong relations)", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid inequality (wrong relations): " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             // we check that the number of arguments of the inequality are valid
//             // this is probably not necessary, since the parser should check this
//             if (ineq.args.length!=2){
//                 //console.log("Invalid input, not a valid inequality", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid inequality (wrong number of arguments): " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             // we check that the arguments of the inequality are valid
//             // one must be constant and the other a variable
//             const typeArgs = new Set(ineq.args.map((e)=> e.type));
//             if (!typeArgs.has("SymbolNode")){ // at least one must be variable
//                 //console.log("Invalid input, not a valid inequality (variable needed))", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid inequality (variable needed): " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             if (ineq.args[0].type=="SymbolNode"){//equation of the form x op a
//                 //console.log("Variable first");
//                 if (!isMathConstant(ineq.args[1].toString())){
//                     //console.log("Invalid input, not a valid inequality (constant needed))", ineq.toString());
//                     updateErrorMessage("Invalid piecewise format, not a valid inequality (constant needed): " + ineq.toString());
//                     errorPosition = [[i,1]];
//                     return false;
//                 }
//                 switch (ineq.op) {
//                     case "<":
//                         intervals.push([-Infinity, ineq.args[1].evaluate(), 0, 0]);
//                         partNumbers.push(i);
//                         break;
//                     case "<=":
//                         intervals.push([-Infinity, ineq.args[1].evaluate(), 0, 1]);
//                         partNumbers.push(1);
//                         break;
//                     case ">":
//                         intervals.push([ineq.args[1].evaluate(), Infinity, 0, 0]);
//                         partNumbers.push(i);
//                         break;
//                     case ">=":
//                         intervals.push([ineq.args[1].evaluate(), Infinity, 1, 0]);
//                         partNumbers.push(i);
//                         break;
//                     case "==":
//                         intervals.push([ineq.args[1].evaluate(), ineq.args[1].evaluate(), 1, 1]);
//                         partNumbers.push(i);
//                         break;
//                     case "!=":
//                         intervals.push([ineq.args[1].evaluate(), Infinity, 0, 0]);
//                         partNumbers.push(i);
//                         intervals.push([-Infinity, ineq.args[1].evaluate(), 0, 0]);
//                         partNumbers.push(i);
//                         break;
//                 }
//                 //console.log("Added interval: ", intervals[intervals.length-1].toString());
//             }else{//equation of the form a op x
//                 //console.log("variable second")
//                 if (!isMathConstant(ineq.args[0].toString())){
//                     //console.log("Invalid input, not a valid inequality (constant needed))", ineq.toString());
//                     updateErrorMessage("Invalid piecewise format, not a valid inequality (constant needed): " + ineq.toString());
//                     errorPosition = [[i,1]];
//                     return false;
//                 }
//                 switch (ineq.op) {
//                     case "<":
//                         intervals.push([ineq.args[0].evaluate(), Infinity, 0, 0]);
//                         partNumbers.push(i);
//                         break;
//                     case "<=":
//                         intervals.push([ineq.args[0].evaluate(), Infinity, 1, 0]);
//                         partNumbers.push(i);
//                         break;
//                     case ">":
//                         intervals.push([ -Infinity,ineq.args[0].evaluate(), 0, 0]);
//                         partNumbers.push(i);
//                         break;
//                     case ">=":
//                         intervals.push([ -Infinity,ineq.args[0].evaluate(), 0, 1]);
//                         partNumbers.push(i);
//                         break;
//                     case "==":
//                         intervals.push([ineq.args[0].evaluate(), ineq.args[0].evaluate(), 1, 1]);
//                         partNumbers.push(i);
//                         break;
//                     case "!=":
//                         intervals.push([ineq.args[0].evaluate(), Infinity, 0, 0]);
//                         intervals.push([-Infinity, ineq.args[0].evaluate(), 0, 0]);
//                         partNumbers.push(i);
//                         partNumbers.push(i);
//                         break;
//                 }
//                 //console.log("Added interval: ", intervals[intervals.length-1].toString());
//             }
//             // need to check now that the other argument is constant
//         }else{ // now we have a an inequality of the form a<=x<=b, a<x<=b, a<=x<b or a<x<b
//             // the values a and b are the first and last arguments of the inequality
//             // console.log(ineq.toString()," ",ineq.conditionals.length);
//             //const keysIneq = Object.keys(ineq);
//             //if (!(keysIneq[0]=="conditionals" && keysIneq[1]=="params" && keysIneq.length==2)){
//             if (!(ineq.type=="RelationalNode")){
//                 //console.log("Invalid input, not a valid inequality", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid inequality: " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             if (!(ineq.conditionals.length==2)){
//                 //console.log("Invalid input, not a valid chain of inequalities (more than two)", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid chain of inequalities (more than two): " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             if (!ineq.conditionals.every((e)=> e=="smaller" || e=="smallerEq")){
//                 //console.log("Invalid input, not a valid chain of inequalities (only < and <= are allowed)", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid chain of inequalities (only < and <= are allowed): " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             // we check that the arguments of the inequality are valid
//             // the first and third must be constant and the second a variable
//             //console.log(ineq.params);
//             if (!(isMathConstant(ineq.params[0].toString()) &&
//                   ineq.params[1].type=="SymbolNode") &&
//                   isMathConstant(ineq.params[2].toString())){ // the middle parameter must be a symbol a op1 x op2 b
//                 //console.log("Invalid input, not a valid inequality; two constant params and a symbol", ineq.toString());
//                 updateErrorMessage("Invalid piecewise format, not a valid inequality (two constant params and a symbol): " + ineq.toString());
//                 errorPosition = [[i,1]];
//                 return false;
//             }
//             if (ineq.conditionals[0]=="smallerEq" && ineq.conditionals[1]=="smallerEq"){ // a<=x<=b
//                 intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 1, 1]);
//                 partNumbers.push(i);
//                 //console.log("Added interval: ", intervals[intervals.length-1].toString());
//             }
//             if (ineq.conditionals[0]=="smaller" && ineq.conditionals[1]=="smallerEq"){ // a<x<=b
//                 intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 0, 1]);
//                 partNumbers.push(i);
//                 //console.log("Added interval: ", intervals[intervals.length-1].toString());
//             }
//             if (ineq.conditionals[0]=="smallerEq" && ineq.conditionals[1]=="smaller"){ // a<=x<b
//                 intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 1, 0]);
//                 partNumbers.push(i);
//                 //console.log("Added interval: ", intervals[intervals.length-1].toString());
//             }
//             if (ineq.conditionals[0]=="smaller" && ineq.conditionals[1]=="smaller"){ // a<x<b
//                 intervals.push([ineq.params[0].evaluate(), ineq.params[2].evaluate(), 0, 0]);
//                 partNumbers.push(i);
//                 //console.log("Added interval: ", intervals[intervals.length-1].toString());
//             }
//         }
//     }
//     //console.log("Intervals: ", intervals.map((e)=> e.toString()));
//     // now it remains to check that the intervals are disjoint
//     // first we sort the intervals by their first element
//     let sortedIntervals=intervals.toSorted((a,b)=> (a[0]-b[0]==0) ? (a[1]-b[1]) : (a[0]-b[0]));
//     //console.log("Intervals sorted: ", intervals.map((e)=> e.toString()));
//     for (let i=0;i<intervals.length-1;i++){
//         const a = sortedIntervals[i];
//         const b = sortedIntervals[i+1];
//         if (a[1]> b[0]){ // if the end of the first interval is greater than the start of the second interval
//             //console.log("Intervals are not disjoint: ", a.toString(), b.toString());

//             // Find the original indices of the overlapping intervals
//             const aIndex = intervals.findIndex(interval =>
//                 interval[0] === a[0] && interval[1] === a[1] && interval[2] === a[2] && interval[3] === a[3]
//             );
//             const bIndex = intervals.findIndex((interval, idx) =>
//                 idx !== aIndex && interval[0] === b[0] && interval[1] === b[1] && interval[2] === b[2] && interval[3] === b[3]
//             );

//             // Use partNumbers to get the correct part indices
//             const aPartIndex = aIndex >= 0 && aIndex < partNumbers.length ? partNumbers[aIndex] : aIndex;
//             const bPartIndex = bIndex >= 0 && bIndex < partNumbers.length ? partNumbers[bIndex] : bIndex;

//             // Create user-friendly error message
//             updateErrorMessage(`Overlap detected between Part ${aPartIndex + 1} and Part ${bPartIndex + 1}. Please adjust the conditions to avoid overlap`);
//             errorPosition = [[aPartIndex, 1], [bPartIndex, 1]]; // Both conditions have errors
//             return false;
//         }
//         if (a[1]==b[0] && a[3]*b[2]==1){ // if the end of the first interval is equal to the start of the second interval
//             //console.log("Intervals are not disjoint: ", a.toString(), b.toString());

//             // Find the original indices of the overlapping intervals
//             const aIndex = intervals.findIndex(interval =>
//                 interval[0] === a[0] && interval[1] === a[1] && interval[2] === a[2] && interval[3] === a[3]
//             );
//             const bIndex = intervals.findIndex((interval, idx) =>
//                 idx !== aIndex && interval[0] === b[0] && interval[1] === b[1] && interval[2] === b[2] && interval[3] === b[3]
//             );

//             // Use partNumbers to get the correct part indices
//             const aPartIndex = aIndex >= 0 && aIndex < partNumbers.length ? partNumbers[aIndex] : aIndex;
//             const bPartIndex = bIndex >= 0 && bIndex < partNumbers.length ? partNumbers[bIndex] : bIndex;

//             // Create user-friendly error message
//             updateErrorMessage(`Boundary conflict between Part ${aPartIndex + 1} and Part ${bPartIndex + 1}. Both parts include the same point. Please use < or > instead of <= or >=`);
//             errorPosition = [[aPartIndex, 1], [bPartIndex, 1]]; // Both conditions have errors
//             return false;
//         }
//     }
//     return true;
// }

// the output is a translation of the input string into a javascript expression "C ? A : B"
// the input has already been checked to be piecewise
function parsePiecewise(txt){
    // simplifyConstant is a function that simplifies the constants in the expression
    // it also uses implicit multiplication
    // for instance, 2 x is translated into 2*x
    function simplify(it){
        console.log("Simplifying: ", it.toString());
        return math.simplifyConstant(it.toString()).toString({implicit: 'show'});
    }
    function items2expr(its){ //its is a list of items, each item is a pair [expr,ineq]
        if (its.length==0){
            return "NaN";
        }
        const it=its[0]; // the first item
        let fn = it.items[0]; // the function expression
        console.log("Parsing function: ", fn);
        if (fn.type=="AssignmentNode"){
            fn = fn.value; // we take the value of the assignment, that is the expression of the function
        }
        if (fn.type=="FunctionAssignmentNode"){
            fn = fn.expr; // we take the expression of the function
        }
        console.log("Parsing function: (after check assignment) ", fn);

        fn=simplify(fn); 
        console.log("Function: ", fn.toString());
        const ineq=transformAssingnments(it.items[1]); // the inequality or equality where the function is defined, we change assignments to equalities
        let cond; // the condition of "C ? A : B"
        // inequalities of the form a op1 x op2 b are translate into a op1 x && x op2 b
        if ("op" in ineq){ //that is a single inequality or an equality
            if (ineq.op =="!="){ // this is a not equal
                cond = "!("+simplify(ineq.args[0]) + "==" + simplify(ineq.args[1])+")";
            }else{
                cond = ineq.toString();
            }
        }else{
            cond = simplify(ineq.params[0])
            cond += ineq.conditionals[0]=="smallerEq" ? "<=" : "<";
            cond += ineq.params[1].toString() + " && " + simplify(ineq.params[1]);
            cond += ineq.conditionals[1]=="smallerEq" ? "<=" : "<";
            cond += simplify(ineq.params[2]);
        }
        return cond + " ? (" + fn.toString() + ") : (" + items2expr(its.slice(1)) + ")";
    }
    return items2expr(math.parse(txt).items);
};

// this function determines the position of "separating commas" in a string
// for instance "log(x,2),2" contains one separating comma
// export function separatingCommas(txt){
//     let count=0;
//     let positionCommas=[];
//     for (let i=0;i<txt.length;i++){
//         if ((txt[i]==",") && (count==0)){ // we are not inside a function
//             positionCommas.push(i);
//         }
//         if (txt[i]=="("){
//             count++;
//         }
//         if (txt[i]==")"){
//             if (count==0){ // we have an error, we have more closing parentheses than opening ones
//                 errorMessage = "Invalid expression, too many closing parentheses";
//                 errorPosition = 0;
//                 return [];
//             }
//             count--;
//         }
//     }
//     return positionCommas;
// }


// this function returns {function: "fn", condition: "cn"} for the input "[fn,cn]"
// it uses separatingCommas
// function splitFunctionCondition(txt){
//     const positions = separatingCommas(txt);
//     if (positions.length != 1) {
//         errorMessage = "Invalid function condition format";
//         return null;
//     }
//     if (txt[0] != "[" || txt[txt.length-1] != "]") {
//         errorMessage = "Invalid function condition format";
//         return null;
//     }
//     const fn = txt.slice(1, positions[0]);
//     const cn = txt.slice(positions[0] + 1, txt.length - 1);
//     return {function: fn, condition: cn};
// }

// this function returns a list  [{function: "fn1", condition: "cn1"},...] for a string of the form "[[fn1,cn1],[fn2,cn2],...]"
// function listFunctionConditions(txt){
//     if (txt[0] != "[" || txt[txt.length-1] != "]") {
//         errorMessage = "Invalid piecewise format";
//         return null;
//     }
//     let parts = [];
//     let nparts = 0;
//     let current = txt.slice(1, -1).trim(); // remove the outer brackets
//     while (current.length > 0){
//         console.log("current:", current);
//         if (current[0]!="["){
//             errorMessage = "Invalid piecewise format, missing opening bracket";
//             errorPosition = nparts;
//             return null;
//         }
//         let nextClosePosition = current.indexOf("]");
//         if (nextClosePosition === -1) {
//             errorMessage = "Invalid piecewise format, missing closing bracket";
//             errorPosition = nparts;
//             return null;
//         }
//         let fncnd = splitFunctionCondition(current.slice(0, nextClosePosition + 1));
//         if (fncnd === null){
//             errorMessage = "Wrong function expression or condition";
//             errorPosition = nparts;
//             return null;
//         }
//         console.log("New part ",fncnd);
//         parts.push(fncnd);
//         nparts++;
//         let j=nextClosePosition + 1;
//         while(current[j] === " " || current[j] === ","){
//             j++;
//             if (j >= current.length) {
//                 errorMessage = "Invalid piecewise format, unexpected end of string";
//                 errorPosition = nparts;
//                 return null;
//             }
//         }
//         current = current.slice(j).trim();
//     }
//     return parts;
// }

// function parts to a single string of the form "[[fn1,cn1],[fn2,cn2],...]"
export function functionDefPiecewiseToString(parts){
    let txt = "[";
    for (let i=0;i<parts.length;i++){
        txt+="["+parts[i][0]+","+parts[i][1]+"]";
        if (i<parts.length-1){
            txt+=",";
        }
    }
    txt+="]";
    return txt;
}

// this function checks that the input is a valid function expression
// either single or piecewise
// it returns the parsed javascript expression and a list of errors with their positions (for piecewise functions)
// error position [i,j] means that it was produced in the ith part of the function, j=0 is the function, j=1 is the constraint
export function checkMathSpell(func){
    let errorList = []; // array of pairs [errorMessage, errorPosition]
    if (func.type==="function"){
        // we are allowing ** to be used as a power operator, so we replace it with ^
        const txt = (func.functionDef).replace(/\*\*/g, '^'); // replace ** with ^
        // console.log("Single function to check: ", txt);
        errorMessage = null; // reset error message
        errorPosition = 0; // reset error position
                if(isAssignment(txt)){
                   const txt_parsed = math.parse(txt);
                   if (txt_parsed.type === "AssignmentNode" && txt_parsed.object.name!="y" ){
                        errorMessage = "Invalid assignment, only y=... of f(x)= is allowed";
                        return ["0", [[errorMessage, 0]]];
                   }
                   if (txt_parsed.type === "FunctionAssignmentNode" && txt_parsed.params.length!=1){
                        errorMessage = "Invalid assignment, only functions of one variable are allowed";
                        return ["0", [[errorMessage, 0]]];
                   }
                   if (txt_parsed.type === "FunctionAssignmentNode" && txt_parsed.params[0]!="x"){
                        errorMessage = "Invalid assignment, only functions in variable x are allowed";
                        return ["0", [[errorMessage, 0]]];
                   }
                   if(isOneVariableFunction(getAssignmentExpression(txt))){
                        // jessiecode does does not understand E, e, pi, we translate them to mathjs constants
                        console.log("Single function is valid, parsing: ", transformMathConstants(math.parse(getAssignmentExpression(txt))).toString({implicit: 'show'}));
                        return [transformMathConstants(math.parse(getAssignmentExpression(txt))).toString({implicit: 'show'}), []];
                    }
                 }else{        
                    if(isOneVariableFunction(txt)){
                    // jessiecode does does not understand E, e, pi, we translate them to mathjs constants
                    return [transformMathConstants(math.parse(txt)).toString({implicit: 'show'}), []];
                }
        }
        return ["0", [[errorMessage, 0]]];
    }
    if (func.type==="piecewise_function"){
        // we are allowing ** to be used as a power operator, so we replace it with ^
        const parts = (func.functionDef).map((e) => [e[0].replace(/\*\*/g, '^'), e[1].replace(/\*\*/g, '^')]);
        //const parts = listFunctionConditions(txt);
        // console.log("Parts of piecewise function:", parts);
        // if (parts === null) {
        //     errorMessage="Invalid format on definition or condition";
        //     return ["0", errorMessage, errorPosition];
        // }
        let errorInConditions = false;
        for (let i=0;i<parts.length;i++){
            errorMessage = null;
            errorPosition = [i, 0];
            const fn = parts[i][0];
            const cn = parts[i][1];
            if(isAssignment(fn)){
            const txt_parsed = math.parse(fn);
                if (txt_parsed.type === "AssignmentNode" && txt_parsed.object.name!="y" ){
                        errorMessage = "Invalid assignment, only y=... of f(x)= is allowed";
                        errorPosition = [i, 0];
                        errorList.push([errorMessage, errorPosition]);
                }
                if (txt_parsed.type === "FunctionAssignmentNode" && txt_parsed.params.length!=1){
                        errorMessage = "Invalid assignment, only functions of one variable are allowed";
                        errorPosition = [i, 0];
                        errorList.push([errorMessage, errorPosition]);
                }
                if (txt_parsed.type === "FunctionAssignmentNode" && txt_parsed.params[0]!="x"){
                        errorMessage = "Invalid assignment, only functions in variable x are allowed";
                        errorPosition = [i, 0];
                        errorList.push([errorMessage, errorPosition]);
                }
            }

            if (!(isOneVariableFunction(getAssignmentExpression(fn)))){
                //errorMessage = "Invalid function format";
                errorPosition = [i, 0];
                //return ["0", errorMessage, errorPosition];
                errorList.push([errorMessage, errorPosition]);
            }
            if (!(isInequality(cn))){
                //errorMessage = "Invalid condition format";
                errorPosition = [i, 1];
                errorList.push([errorMessage, errorPosition]);
                errorInConditions = true;
            }
        }
        //console.log("Inequalities are compatible? ",isListOfCompatibleInequalities(parts.map((e)=>e[1])));
        let compatIneq = false;
        // console.log("Error in conditions?", errorInConditions);
        if(!errorInConditions){ //if there are no errors in conditions, we check for compatibility of constraints
            compatIneq = isListOfCompatibleInequalities(parts.map((e)=>e[1]));
        }
        if (errorList.length > 0) {
            if (!errorInConditions && !compatIneq){
                errorPosition.forEach((pos)=> errorList.push([errorMessage, pos]));
            }
            return ["0", errorList];
        }
        // for the input to be a piecewise function, the only thing left to see is if the constraints are compatible
        if (compatIneq){
            const txt = functionDefPiecewiseToString(parts);
            // jessiecode does does not understand E, e, pi, we translate them to mathjs constants
            const expr = transformMathConstants(math.parse(txt)).toString();
            return [parsePiecewise(expr), errorList];
        }
        if (errorPosition===0){ // this should not happen, just in case
            errorList.push([errorMessage, [0, 0]]);
            return ["0", errorList];
        }
        errorPosition.forEach((pos)=> errorList.push([errorMessage, pos]));
        return ["0", errorList];
    }
    //no more options
    return ["0", errorList];
}
