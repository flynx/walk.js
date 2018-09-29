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
var walk = 
module.walk =
function(getter, state, ...nodes){
	var func
	// this is used to break out of the recursion...
	// NOTE: this can leak out but we only care about it's identity thus
	// 		no damage can be done...
	var WalkStopException
	var err_res

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
		try{
			return _step(func ? Object.create(func.prototype) : {}, nodes, res)

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
