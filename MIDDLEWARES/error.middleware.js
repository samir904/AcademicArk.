const errorMiddleware=(err,req,res,next)=>{
    const statusCode=err.statusCode||500;
    const message=err.message || "Internal server error!";

    console.log(`error through middleware${err}`)

    res.status(statusCode).json({
        success:false,
        message:message,
        stack:process.env.NODE_ENV === "development" ? err.stack : undefined
    })
}

export default errorMiddleware;