const express = require('express')
const router = express.Router();

router.get("/", (req, res) => {
    res.json("This is a service route")
})

module.exports = router