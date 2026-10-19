import express from 'express'
const router = express.Router();

router.get("/", (req, res) => {
    res.json("This is a notification route")
})

export default router