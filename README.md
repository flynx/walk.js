# walk.js

An extensible tree walk(..) framework...

## Theory and operation

This module generalizes structure traverse (*walking*). This is done via a `walk(..)` function that recieves a user-defined `getter(..)` and returns a *walker*.

`walk(getter)(state, ...nodes) -> state`  
`walk(getter, state)(...nodes) -> state`  
`walk(getter, state, ...nodes) -> state`  
- Recieves a `getter` function a `state` and a list of `nodes`,
- Iterates through `nodes` calling the `getter(..)` per node, threading the `state` through each call,
- Returns the `state` when there are no more `nodes`.

`getter(state, node, next, down, stop) -> state`  
- Recieves `state`, `node` and three control functions: `next`, `down` and `stop`,
- Can process `node` and `state`,
- Can queue nodes for walking via `next(...nodes)`
- Can walk nodes directly via `down(state, ...nodes) -> state`
- Can abbort *walking* and return a state via `stop()` or `stop(state)`
- Returns `state`,

A trivial *flat* example...
```javascript
walk(function(r, n){ return r+n }, 0, ...[1,2,3]) // -> 6
```

The above is essentially equivalent to...
```javascript
[1,2,3].reduce(function(r, n){ return r+n }, 0) // -> 6
```

And for trivial or *flat* lists `.reduce(..)` and friends are simpler and more logical.

Target use-cases:
- The input is not *flat*:
	```javascript
	var sum = walk(function(r, n){
		return n instanceof Array ?
			down(r, ...n)
			: r + n }, 0) 
			
	sum( [1, [2, 3], 4, [[5], 6]] ) // -> 21
	```
	For reference here is a *recursive* `.reduce(..)` example:
	```javascript
	function sumr(l){
		return l.reduce(function(r, e){
			return r + (e instanceof Array ?
				sumr(e)
				: e) }, 0) }

	sumr( [1, [2, 3], 4, [[5], 6]] ) // -> 21
	```
- Need to abort the recursion prematurelly:
	```javascript
	// check if structure contains 0...
	var containsZero = walk(function(r, e, next, down, stop){
		return e === 0 ? 
				// target found, abort the search...
				stop(true)
			: e instanceof Array ?
				// breadth-first walk...
				!!next(...e)
			: r }, false)

	containsZero( [1, [2, 0], 4, [[5], 6]] ) // -> true
	containsZero( [1, [2, 5], 4, [[5], 6]] ) // -> false
	```
	See a more usefull search in [examples](#examples)...


## Installation and loading

```shell
$ npm install --save generic-walk
```

```javascript
var walk = require('generic-walk').walk
```

*Note: This module supports both AMD and node's `require(..)`**


## API

`walk(getter(..)) -> walker(state, ...nodes)`  
Construct a reusable walker.


`walk(getter(..), state) -> walker(...nodes)`  
Construct a reusable walker with fixed initial state.


`walk(getter(..), state, ...nodes) -> result`  
Walk the nodes.


### The getter

`getter(state, node, next(..), down(..), stop(..)) -> state`  
User provided function, called to process a node.


`next(...nodes)`  
Queue `nodes` for walking. The queued nodes will get *walked* after this level of nodes is done (i.e. the `getter(..)` is called for each node on level).


`down(state, ...nodes) -> state`  
Walk `nodes` and return `state`. The nodes will get *walked* immidiately.


`stop()`  
`stop(state)`  
Stop walking and return `state`. The passed `state` is directly returned from the *walker*.

*Note that `stop(..)` behaves in a similar manner to `return`, i.e. execution is aborted immidiately.*


## Examples

Sum all the values of a nested array (breadth-first)...
```javascript
var sum = walk(function(res, node, next){
	return node instanceof Array ?
		// compensate for that next(..) returns undefined...
		next(...node) 
			|| res
		: res + node }, 0)

sum([1, [2], 3, [[4, 5]]]) // -> 15 ...walks the nodes: 1, 3, 2, 4, 5
```

Sum all the values of a nested array (depth-first)...
```javascript
var sumd = walk(function(res, node, next, down, stop){
	return node instanceof Array ?
		down(res, ...node)
		: res + node }, 0)

sumd([1, [2], 3, [[4, 5]]]) // -> 15 ...walks the nodes: 1, 2, 3, 4, 5
```

FInd first zero in tree and return it's path...
```javascript
// XXX res/path threading seem unnatural here...
var __firstZero = walk(function(res, node, next, down, stop){
	var k = node[0]
	var v = node[1]
	var path = res[0]
	return v === 0 ?
			// NOTE: we .slice(1) here to remove the initial null
			//		we added in firstZero(..)...
			stop([ path.slice(1).concat([k]) ])
		: v instanceof Object?
			down(
				[path.concat([k]), null], 
				...Object.entries(v))
		: res }, [[], null])
var firstZero = function(value){ 
	// NOTE: we are wrapping the input here to make it the same 
	//		format as that of Object.entries(..) items...
	return __firstZero([null, value]).pop() }

firstZero([10, 5, [{x: 1, y: 0}, 4]]) // -> ['2', '0', 'y']
```


FInd first zero in tree and return it's path...
```javascript
// same as the above but illustrates a different strategy, a bit
// cleaner but creates a walker every time it's called...
var firstZero = function(value){
	return walk(
		function(res, node, next, down, stop){
			var k = node[0]
			var v = node[1]
			var path = res[0]
			return v === 0 ?
					// NOTE: we .slice(1) here to remove the initial null
					//		we added in firstZero(..)...
					stop([ path.slice(1).concat([k]) ])
				: v instanceof Object?
					down(
						[path.concat([k]), null], 
						...Object.entries(v))
				: res }, 
		[[], null], 
		// wrap the input to make it compatible with Object.entries(..) 
		// items...
		[null, value])
			// separate the result from path...
			.pop() }

firstZero([10, 5, [{x: 1, y: 0}, 4]]) // -> ['2', '0', 'y']
```


