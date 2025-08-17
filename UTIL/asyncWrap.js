function asyncWrap(fn){
    return function(req,res,next){
        Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('Async error:', err); // Optional: Log for debugging
      next(err);
    });
    }
}

export default asyncWrap;