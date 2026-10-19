const express = require('express')
const router = express.Router();

router.get("/", (req, res) => {
    res.json("This is a notification route")
})

module.exports = router