import express from 'express'
const router = express.Router();

router.get("/", (req, res) => {
    res.json("This is a queue route")
})

export default router