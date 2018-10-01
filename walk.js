/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// Walk a set of nodes...
// 
//	Construct a walker...
//	walk(getter(..))
//	walk(getter(..), done(..))
//		-> walker(state, ...nodes)
//
//	Construct a walker with a curried start state...
//	walk(getter(..), state)
//	walk(getter(..), done(..), state)
//		-> walker(...nodes)
//
//	Walk the set of nodes...
//	walk(getter(..), state, ...nodes)
//	walk(getter(..), done(..), state, ...nodes)
//		-> state
//
// NOTE: state can not be a function...
//
//
// XXX this is essentially a version of .reduce(..), I wonder if it is 
// 		feasible to do a version of .map(..), i.e. a mechanism to modify/clone
// 		the input...
// XXX can we hint chrome to show the two singatures???
// XXX need to remove the restriction of not being able to pass functions
// 		into state unless done(..) is given...
var walk = 
module.walk =
function(getter, state, ...nodes){
	// normalize the args...
	var done
	// we've got a done handler passed...
	if(state instanceof Function){
		done = state
		state = nodes.shift()
	}

	// holds the constructed walker function, used mainly to link its 
	// .prototype to the context of the getter(..)...
	var func
	// this is used to break out of the recursion...
	// NOTE: this can leak out but we only care about it's identity thus
	// 		no damage is likely to be done...
	var WalkStopException
	// this is used to hold the result when stop(..) is called, until we 
	// catch WalkStopException and return it from the walker...
	var stop_res

	// handle the getter(..) i/o for the user per call...
	var _step = function(context, nodes, res){
		// construct a comfortable env for the user and handle the 
		// results...
		var _get = function(node){
			var next_nodes = []

			// stop walking...
			// 	stop()
			// 	stop(value)
			//
			// NOTE: 'throw' is used to stop all handling, including 
			// 		the rest of the current level...
			var stop = function(state){
				stop_res = state
				WalkStopException = new Error('WALK_STOP_EVENT')
				throw WalkStopException 
			}

			// handle more nodes...
			//
			// 	Qeueue nodes for processing (breadth-first)...
			// 	next('queue', state, ...nodes) 
			// 		-> state
			// 		NOTE: this returns state as-is, this is done to 
			// 			preserve signature compatibility with 
			// 			next('do', ..)...
			//
			// 	Process nodes (depth-first)...
			// 	next('do', state, ...nodes) 
			// 		-> state
			//
			// 	Stop processing and return from walker...
			// 	next('stop')
			// 	next('stop', state)
			//
			var next = function(action, state, ...nodes){
				// queue nodes (breadth-first)...
				if(action == 'queue'){
					next_nodes = nodes

				// process nodes (depth-first)...
				} else if(action == 'do'){
					state = _step(context, nodes, state)

				// stop processing...
				} else if(action == 'stop'){
					stop(state)
				}
				return state
			}

			// call the getter...
			res = getter.call(context, res, node, next, stop)

			return next_nodes
		}

		return nodes.length == 0 ?
			// no new nodes to walk...
			res
			// do the next level...
			// NOTE: see note below... ( ;) )
			: _step(context, nodes
				.map(_get)
				.reduce(function(next_nodes, e){
					return e instanceof Array ? 
						next_nodes.concat(e) 
						: next_nodes.push(e) }, []), res) 
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

		// call the done handler...
		res = done ?
			done.call(context, res)
			: res

		return res
	}

	return (
		// reusable walker...
		arguments.length == (done ? 2 : 1) ?
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
		: arguments.length == (done ? 3 : 2) ?
			(func = function(...nodes){
				return _walk(nodes, state) })
		// walk...
		: _walk(nodes, state))
}



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
