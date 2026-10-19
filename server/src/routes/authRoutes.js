import { Router } from 'express'

const router = Router();

router.get("/", (req, res) => {
    res.json("This is a auth route")
})

export default router