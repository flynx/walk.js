/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// Walk...
//
//	Construct a reusable walker function...
//	walk(get(..))
//		-> func(state, ...nodes)
//
//	Construct a reusable walker function with set initial state...
//	walk(get(..), state)
//		-> func(...nodes)
//
//	Walk the nodes...
//	walk(get(..), state, ...nodes)
//		-> res
//
// The get(..) that walk(..) expects has the following signature:
//		get(res, node, next(..), down(..), stop(..))
//			-> res
//
//		Queue next nodes to walk...
//		next(...nodes)
//			-> undefined
//			NOTE: this will just queue the nodes and return immediately.
//			NOTE: the state is passed to the nodes implicitly, the get(..)
//				handling first node from this list will get the last result
//				returned by the last get(..) call on this level as it's 
//				state.
//
//		Walk the next set of nodes...
//		down(state, ...nodes)
//			-> res
//			NOTE: this will process all the nodes and then return the 
//				result.
//
//		Stop the walk...
//		stop()
//		stop(result)
//			-> undefined
//			NOTE: this will break current function execution in a similar 
//				effect to 'return', i.e. no code in function will be 
//				executed after stop(..) call...
//			NOTE: this is done by throwing a special error, this error 
//				should either not be caught or must be re-thrown, as 
//				shadowing this exception may have unexpected results...
//
//
// Example:
//		// sum all the values of a nested array...
//		var sum = walk(function(res, node, next){
//			return node instanceof Array ?
//				// compensate for that next(..) returns undefined...
//				next(...node) 
//					|| res
//				: res + node }, 0)
//
//		// depth first walker...
//		var sumd = walk(function(res, node, next, down, stop){
//			return node instanceof Array ?
//				down(res, ...node)
//				: res + node }, 0)
//
//		sum([1, [2], 3, [[4, 5]]]) // -> 15 ...walks the nodes: 1, 3, 2, 4, 5
//		sumd([1, [2], 3, [[4, 5]]]) // -> 15 ...walks the nodes: 1, 2, 3, 4, 5
//
//
// Example:
// 		// XXX res/path threading seem unnatural here...
// 		var __firstZero = walk(function(res, node, next, down, stop){
// 			var k = node[0]
// 			var v = node[1]
// 			var path = res[0]
// 			return v === 0 ?
// 					// NOTE: we .slice(1) here to remove the initial null
// 					//		we added in firstZero(..)...
// 					stop([ path.slice(1).concat([k]) ])
// 				: v instanceof Object?
// 					down(
// 						[path.concat([k]), null], 
// 						...Object.entries(v))
// 				: res }, [[], null])
// 		var firstZero = function(value){ 
// 			// NOTE: we are wrapping the input here to make it the same 
// 			//		format as that of Object.entries(..) items...
// 			return __firstZero([null, value]).pop() }
//
//
// 		// same as the above but illustrates a different strategy, a bit
// 		// cleaner but creates a walker every time it's called...
// 		var firstZero = function(value){
// 			return walk(
// 				function(res, node, next, down, stop){
// 			        var k = node[0]
// 					var v = node[1]
// 					var path = res[0]
// 					return v === 0 ?
// 							// NOTE: we .slice(1) here to remove the initial null
// 							//		we added in firstZero(..)...
// 							stop([ path.slice(1).concat([k]) ])
// 						: v instanceof Object?
// 							down(
// 								[path.concat([k]), null], 
// 								...Object.entries(v))
// 						: res }, 
// 				[[], null], 
// 				// wrap the input to make it compatible with Object.entries(..) 
// 				// items...
// 				[null, value])
// 					// separate the result from path...
// 					.pop() }
//
//
// 		firstZero([10, 5, [{x: 1, y: 0}, 4]]) // -> ['2', '0', 'y']
//
//
//
// NOTE: a walker is returned iff walk(..) is passed a single argument.
// NOTE: the following two are equivalent:
// 		walk(get, start, ...nodes) 
// 		walk(get)(start, ...nodes)
// NOTE: walk goes breadth first...
//
// XXX might be a good idea to move this into it's own module...
// 		generic-walk might be a good name...
var walk = function(get, state, ...nodes){
	// this is used to break out of the recursion...
	// NOTE: this can leak out but we only care about it's identity thus
	// 		no damage can be done...
	var WalkStopException
	var err_res

	var _step = function(nodes, res){
		// construct a comfortable env for the user and handle the 
		// results...
		var _get = function(node){
			var next = []
			res = get(
				res, 
				node, 
				// breadth first step...
				// 	next(...nodes) -> undefined
				function(...nodes){ next = nodes },
				// depth first step...
				// 	down(state, ..nodes) -> res
				function(res, ...nodes){ 
					return _step(nodes, res) },
				// stop...
				// 	stop()
				// 	stop(value)
				//
				// NOTE: 'throw' is used to stop all handling, including 
				// 		the rest of the current level...
				function(r){
					err_res = r
					WalkStopException = new Error('WALK_STOP_EVENT')
					throw WalkStopException 
				})
			return next
		}

		return nodes.length == 0 ?
			// no new nodes to walk...
			res
			// do the next level...
			// NOTE: see note below... ( ;) )
			: _step(nodes
				.map(_get)
				.reduce(function(next, e){
					return e instanceof Array ? 
						next.concat(e) 
						: next.push(e) }, []), res) 
	} 
	// _step(..) wrapper, handle WalkStopException... 
	var _walk = function(nodes, res){
		try{
			return _step(nodes, res)

		} catch(e){
			// handle the abort condition...
			if(e === WalkStopException){
				return err_res
			}
			// something broke...
			throw e
		}
	}

	return (
		// return a reusable walker...
		arguments.length == 1 ?
			// NOTE: this wrapper is here so as to isolate and re-order res 
			// 		construction and passing it to the next level...
			// 		this is needed as when we do:
			// 			step(res, ...nodes.map(_get).reduce(...))
			// 		res (if immutable) will first get passed by value and 
			// 		then will get re-assigned in _get(..), thus step(..) will 
			// 		not see the updated version...
			// 		This approach simply pushes the pass-by-value of res till 
			// 		after it gets updated by _get(..).
			function(res, ...nodes){
				return _walk(nodes, res) }
		// reusable walker with a curried initial state... 
		// NOTE: better keep this immutable or clone this in get(..)
		: arguments.length == 2 ?
			function(...nodes){
				return _walk(nodes, state) }
		// walk...
		: _walk(nodes, state))
}




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
