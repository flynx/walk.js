# walk.js

An extensible tree walk(..) framework...


- [walk.js](#walkjs)
	- [Theory and operation](#theory-and-operation)
		- [Constructing the walker and walking ( walk(..) )](#constructing-the-walker-and-walking--walk)
		- [Getting and processing nodes ( getter(..) )](#getting-and-processing-nodes--getter)
		- [Putting it all together](#putting-it-all-together)
	- [Installation and loading](#installation-and-loading)
	- [API](#api)
		- [`walk(..)`](#walk)
		- [`getter(..)`](#getter)
		- [`done(..)` (optional)](#done-optional)
	- [Examples](#examples)



## Theory and operation

This module generalizes structure traverse (*walking*). This is done via a `walk(..)` function that recieves a user-defined `getter(..)` function and returns a *walker*.


### Constructing the walker and walking ( walk(..) )

`walk(getter[, done])(state, ...nodes) -> state`  
`walk(getter[, done], state)(...nodes) -> state`  
`walk(getter[, done], state, ...nodes) -> state`  
- Recieves a `getter` function, an optional `done` function, a `state` and a list of `nodes`,
- Iterates through `nodes`, calling the `getter(..)` per node and threading the `state` through each call,
- If `done(..)` is given, it is called passing the `state` after walking is done, the return value is set as the new `state` value,
- Returns the `state` when there are no more `nodes`.


### Getting and processing nodes ( getter(..) )

`getter(state, node, next, stop) -> state`  
- Recieves `state`, `node` and two control functions: `next` and `stop`,
- Called in a context (`this`), persistent within one `walk(..)` call, inherited from *walker*`.prototype` and usable to store data between `getter(..)` calls,
- Can process `node` and `state`,
- Can queue nodes for walking via `next('queue', state, ...nodes)`
- Can walk nodes directly via `next('do', state, ...nodes) -> state`
- Can abbort *walking* and return a state via `stop()` or `stop(state)`
- Returns `state`,


### Putting it all together

A trivial *flat* example...
```javascript
walk(function(r, n){ return r+n }, 0, ...[1,2,3]) // -> 6
```

The above is essentially equivalent to...
```javascript
[1,2,3].reduce(function(r, n){ return r+n }, 0) // -> 6
```

And for *flat* lists `.reduce(..)` and friends are simpler and more logical. `walk(..)` is designed to simplify more complex cases:

- The input is not *flat*:
	```javascript
	// sum the items in a *deep* array (depth-first)...
	var sum = walk(function(r, n, next){
		return n instanceof Array ?
			next('do', r, ...n)
			: r + n }, 0) 
			
	sum( [1, [2, 3], 4, [[5], 6]] ) // -> 21
	```
	For reference here is a *recursive* `.reduce(..)` example, already a bit more complex:
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
	var containsZero = walk(function(r, e, next, stop){
		// NOTE: we'll only count leaf nodes...
		this.nodes_visited = (this.nodes_visited || 0)
		return e === 0 ? 
				// abort search, report number of nodes visited...
				stop(this.nodes_visited+1)
			: e instanceof Array ?
				next('do', ...e)
			: (this.nodes_visited++, r) }, false)

	containsZero( [1, [2, 0], 4, [[5], 6]] ) // -> 3
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

*Note: This module supports both [`requirejs(..)`](https://requirejs.org) and node's `require(..)`**



## API

### `walk(..)`

`walk(getter(..)) -> walker(state, ...nodes)`  
`walk(getter(..), done(..)) -> walker(state, ...nodes)`  
Construct a reusable walker.


`walk(getter(..), state) -> walker(...nodes)`  
`walk(getter(..), done(..), state) -> walker(...nodes)`  
Construct a reusable walker with fixed initial state.


`walk(getter(..), state, ...nodes) -> result`  
`walk(getter(..), done(..), state, ...nodes) -> result`  
Walk the nodes.

*Note that `state` can not be a function unless `done(..)` is provided.*


### `getter(..)`

`getter(state, node, next(..), stop(..)) -> state`  
User provided function, called to process a node. `getter(..)` is passed the current `state`, the `node` and two control functions: `next(..)` and `stop(..)` to control the *walk* execution flow.


`next('queue', state, ...nodes) -> state`  
Queue `nodes` for walking (*breadth-first*). The queued nodes will get *walked* after this level of nodes is done, i.e. after the `getter(..)` is called for each node on current level.

*Note that this does not change the state in any way and returns it as-is, this is done for signature compatibility with `next('do', ..)`*


`next('do', state, ...nodes) -> state`  
Walk `nodes` (*depth-first*) and return `state`. The nodes will get *walked* immidiately.


`stop()`  
`stop(state)`  
Stop walking and return `state`. The passed `state` is directly returned from the *walker*.

*Note that `stop(..)` behaves in a similar manner to `return`, i.e. execution is aborted immidiately.*


### `done(..)` (optional)

`done(state) -> state`  
User provided function, if given, is called by the *walker* after walking is done (no more nodes to handle). `state` is passed as argument and the return value is returned from the *walker*. This is run in the same context (`this`) as `getter(..)`.



## Examples

Sum all the values of a nested array (breadth-first)...
```javascript
var sum = walk(function(res, node, next){
	return node instanceof Array ?
		next('queue', res, ...node) 
		: res + node }, 0)

sum([1, [2], 3, [[4, 5]]]) // -> 15 ...walks the nodes: 1, 3, 2, 4, 5
```

Sum all the values of a nested array (depth-first)...
```javascript
var sumd = walk(function(res, node, next){
	return node instanceof Array ?
		// yes, this is the only difference...
		next('do', res, ...node)
		: res + node }, 0)

sumd([1, [2], 3, [[4, 5]]]) // -> 15 ...walks the nodes: 1, 2, 3, 4, 5
```

To explicitly see the paths the `sum`/`sumd` take we need to modify them a little:
```javascript
var makeSummer = function(mode){
	var walker = walk(
		function(res, node, next){
			this.log(node)
			return node instanceof Array ?
				next(mode == 'breadth-first' ? 'queue' : 'do', 
					res, 
					...node) 
				: res + node },
		// print the path when done...
		function(state){
			console.log('-->', this.path)
			return state
		}, 
		1) 
	// log the nodes...
	walker.prototype.log = function(node){
		this.path = node instanceof Array ?
			this.path
			: (this.path || []).concat([node]) } 
	return walker
}

var sum = makeSummer('breadth-first')
var sumd = makeSummer('depth-first')

sum([1, [2], 3, [[4, 5]]]) // -> 15

sumd([1, [2], 3, [[4, 5]]]) // -> 15
```

FInd first zero in tree and return it's path...
```javascript
// NOTE: the only reason this is wrapped into a function is that we need
//  	to restrict the number of items (L) this is passed to 1...
var firstZero = function(L){
	return walk(function(res, node, next, stop){
		// setup...
		if(this.path == null){
			this.path = []
			node = [null, node]
		}
		var path = this.path
		var k = node[0]
		var v = node[1]
		return v === 0 ?
				// NOTE: we .slice(1) here to remove the initial null
				//		we added in firstZero(..)...
				stop(path.slice(1).concat([k]))
			: v instanceof Object?
				(path.push(k), 
				next('do', res, ...Object.entries(v)))
			: res}, false, L) }

firstZero([10, 5, [{x: 1, y: 0}, 4]]) // -> ['2', '0', 'y']
```


