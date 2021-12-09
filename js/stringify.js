/**
 * Stringify a dictionary
 * @param passedObj {{}}
 * @param onUpdate {Function}
 * @param onFinish {Function}
 */
const dataToString = function (passedObj, onUpdate, onFinish) {
    for (const i of passedObj) {
        // TODO: add enters for every 64 chars
        onUpdate(JSON.stringify(i).replace(/\[|(\d,){64}|(],)/g, "$&\n") + "\n");
    }

    onFinish();
};

onmessage = function (e) {
    switch (e.data["message"]) {
        case "stringify":
            let data = "";
            dataToString(e.data["data"], (d) => data += d, () => postMessage(data));
    }
}