const axios = require("axios");

class GoogleSheetReporter {

    constructor() {
        this.counter = 1;
    }

    // Blank row add karne ke liye
    async addBlankRow() {

        const payload = [{
            id: "",
            feature: "",
            name: "",
            browser: "",
            status: "",
            duration: ""
        }];

        try {

            await axios.post(
                "https://script.google.com/macros/s/AKfycbyU0I1M6VY82ekLNIE-valWvoYMhF866v3MfQsATXt1-4kwC3ZwldDY8xyac0Afa3oikA/exec",
                payload
            );

            console.log("➖ Blank row added");

        } catch (error) {

            console.error("❌ Failed to add blank row", error.message);

        }
    }

    // Step logging
    async logResult(data) {

        const testId =
            data.testId ||
            `TC_${(data.feature || "TEST").toUpperCase().replace(".spec.js", "")}_${String(this.counter).padStart(3, "0")}`;

        this.counter++;

        const payload = [{
            id: testId,
            feature: data.feature || "",
            name: data.testCase || "",
            browser: data.browser || "chromium",
            status: data.status || "Pass",
            duration: data.duration || 0
        }];

        try {

            await axios.post(
                "https://script.google.com/macros/s/AKfycbyU0I1M6VY82ekLNIE-valWvoYMhF866v3MfQsATXt1-4kwC3ZwldDY8xyac0Afa3oikA/exec",
                payload
            );

            console.log(`✅ Step logged: ${testId} → ${data.testCase}`);

        } catch (error) {

            console.error(`❌ Failed to log step: ${data.testCase}`, error.message);

        }
    }
}

module.exports = GoogleSheetReporter;