/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX might be a good idea to add a way to do something on start/end of 
// 		walk...
// 		...we can easily determine if this is the first call to getter(..)
// 		by checking and then setting an attr on the context...
// XXX this is essentially a version of .reduce(..), I wonder if it is 
// 		feasible to do a version of .map(..), i.e. a mechanism to modify/clone
// 		the input...
// XXX we need a way to handle the walk end event...
// 		ways this can be done:
// 			- a type argument to getter...
// 					getter(action, ...)
// 					getter('start', state)
// 					getter('node', state, node, ...)
// 					getter('stop', state)
// 				+ uniform and adds no new clutter...
// 				- this will make the general case getter more complex
// 				Q: can we implement this or a similar approach in way 
// 					that would abstract the user from the actions unless 
// 					they want to handle it???
// 						...currently, they would need to handle the actions 
// 						to ignore the non-node actions...
// 						...one way to go is to simply mark the first/last 
// 						calls to getter in some way... 
// 						the problem here is that there is no way to tell 
// 						if a specific getter is last before the call is made...
// 			- event handlers (see .onWalkEnd)
// 				- non-uniform...
// 			- a second handler passed to walk(..)
var walk = 
module.walk =
function(getter, state, ...nodes){
	// holds the constructed walker function, used mainly to link its 
	// .prototype to the context of the getter(..)...
	var func
	// this is used to break out of the recursion...
	// NOTE: this can leak out but we only care about it's identity thus
	// 		no damage is likely to be done...
	var WalkStopException
	// This is used to hold the result when stop(..) is called, until we 
	// catch WalkStopException and return it from the walker...
	var stop_res

	// handle the getter(..) i/o for the user per call...
	var _step = function(context, nodes, res){
		// construct a comfortable env for the user and handle the 
		// results...
		var _get = function(node){
			var next = []
			res = getter.call(context,
				res, 
				node, 
				// breadth first step...
				// 	next(...nodes) -> undefined
				function(...nodes){ next = nodes },
				// depth first step...
				// 	down(state, ..nodes) -> res
				function(res, ...nodes){ 
					return _step(context, nodes, res) },
				// stop walking...
				// 	stop()
				// 	stop(value)
				//
				// NOTE: 'throw' is used to stop all handling, including 
				// 		the rest of the current level...
				function(r){
					stop_res = r
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
			: _step(context, nodes
				.map(_get)
				.reduce(function(next, e){
					return e instanceof Array ? 
						next.concat(e) 
						: next.push(e) }, []), res) 
	} 
	// _step(..) wrapper, handle WalkStopException and setup the initial
	// context...
	var _walk = function(nodes, res){
		var context = func ? 
			Object.create(func.prototype) 
			: {}

		try{
			var res = _step(context, nodes, res)

		} catch(e){
			// handle the abort condition...
			if(e === WalkStopException){
				var res = stop_res

			// something broke...
			} else {
				throw e
			}
		}

		// onWalkEnd handler...
		// XXX need a more natural way to do this while providing access 
		// 		to the context...
		res = context.onWalkEnd ?
			context.onWalkEnd(res)
			: res

		return res
	}

	return (
		// reusable walker...
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
			(func = function(state, ...nodes){
				return _walk(nodes, state) })
		// reusable walker with a curried initial state... 
		// NOTE: better keep this immutable or clone this in get(..)
		: arguments.length == 2 ?
			(func = function(...nodes){
				return _walk(nodes, state) })
		// walk...
		: _walk(nodes, state))
}



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
