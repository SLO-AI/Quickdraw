/**
 * A simple network using brain.js. Uses the given layers, error and iterations.
 *
 * @param layerList {[Number]} List of layers
 * @param errorThreshold {Number} The error threshold
 * @param iterations {Number} The number of iterations
 * @param gpu {boolean} True if the network should run on the GPU, otherwise false. CPU is default.
 * @constructor
 */
const Network = function (layerList, errorThreshold, iterations, gpu=false) {
    let net = null;

    /**
     * Train the network with training data.
     *
     * @param trainingData {JSON} Json dataset
     * @return {*}
     */
    this.train = function (trainingData) {

        // TODO: make async. TrainAsync is throwing errors. Issue @ brain.js see
        //  https://github.com/BrainJS/brain.js/issues/721
        // return net.trainAsync(trainingData, {errorThreshold: errorThreshold, iterations: iterations});
        return net.train(trainingData, {errorThreshold: errorThreshold, iterations: iterations});
    }

    /**
     * Test data using the trained network. If the network has not been trained, it returns null.
     *
     * @param testData {JSON} JSON data.
     * @return {*}
     */
    this.test = function (testData) {
		return { run: net.run(testData), likely: brain.likely(testData, net)}
    }

    const init = function () {
        if (gpu)
            net = new brain.NeuralNetworkGPU({hiddenLayers: layerList});
        else
            net = new brain.NeuralNetwork({hiddenLayers: layerList});
    };

    this.getSVG = function() {
        return net ? brain.utilities.toSVG(net) : null;
	};
	
    init();
}

/**
 * A canvas which is able to generate 64x64 black and white images.
 *
 * @param element {HTMLCanvasElement} A HTMLCanvasElement on the page.
 * @param width {Number} The inner width of the canvas.
 * @param height {Number} The inner height of the canvas.
 * @constructor
 */
const DrawingCanvas = function (element, width, height) {
    const black = "rgb(0,0,0)";
    const white = "rgb(255,255,255)";
    const context = element.getContext("2d");
    const styleWidth = element.clientWidth;
    const styleHeight = element.clientHeight;
    let drawing = false;
    let erasing = false;

    const fillWhite = function () {
        context.beginPath();
        context.fillStyle = white;
        context.fillRect(0,0, 64, 64);
        context.fill();
        context.stroke();
    };

    /**
     * Clear the canvas.
     */
    this.clear = function () {
        context.clearRect(0, 0, 64, 64);
        fillWhite();
    }

    /**
     * Obtain the canvas to copy the content.
     *
     * @return {HTMLCanvasElement} The canvas element.
     */
    this.getCanvas = function () {
        return element;
    };

    const init = function () {
        element.width = width;
        element.height = height;

        ['mousedown', 'touchstart'].forEach(
            eventName => element.addEventListener(eventName, (evt) => {
                if (evt.button === 2) {
                    erasing = true;
                    drawing = false;
                } else {
                    drawing = true;
                    erasing = false;
                }
            }));

        ['mouseup', 'touchend', 'touchcancel', 'mouseleave'].forEach(
            eventName => element.addEventListener(eventName, (evt) => {
                drawing = false;
                erasing = false;
            }));



        element.addEventListener("contextmenu", (evt) => {
            evt.preventDefault();
            return false;
        });

        ['mousemove', 'touchmove'].forEach(
            eventName => element.addEventListener(eventName, (evt) => {
                if (!drawing && !erasing)
                    return;

                let color = black;
                if (erasing)
                    color = white;

                let eventX = evt.x;
                let eventY = evt.y;

                if (isNaN(eventX)) {
                    eventX = evt.touches[0].clientX;
                    eventY = evt.touches[0].clientY;
                }

                const x = Math.round((eventX + window.scrollX - element.offsetLeft) / styleWidth * 64);
                const y = Math.round((eventY + window.scrollY - element.offsetTop) / styleHeight * 64);

                context.beginPath();
                context.fillStyle = color;
                context.strokeStyle = color;
                context.fillRect(x, y, 1, 1);
                context.fill();
                context.stroke();
            }));

        fillWhite();
    };

    init();
};

/**
 * Process an image from a fileReader or an HTMLCanvas to binary pixel data.
 *
 * @param imageElement {HTMLImageElement} An image element to render the processing to.
 * @param onFinish {Function} A function to be called when the processing is finished.
 * @param flip {Boolean} Indicates whether the binary data should be flipped. zeroes become ones and vice versa.
 * @constructor
 */
const ImageProcess = function (imageElement, onFinish, flip=false) {
    const img = imageElement;
    const renderCanvas = document.createElement("canvas");
    const renderContext = renderCanvas.getContext("2d");

    const loadImage = (source) => {
        img.onload = () => loadData();
        img.src = source;
    };

    const loadData = () => {
        let pixelData = []
        renderContext.drawImage(img, 0, 0);
        const imgData = renderContext.getImageData(0, 0, img.width, img.height).data;

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const n = (y * img.width + x) * 4;

                if (imgData[n] >= 200 || imgData[n + 1] >= 200) {
                    if (flip)
                        pixelData.push(1);
                    else
                        pixelData.push(0);
                }
                else {
                    if (flip)
                        pixelData.push(0);
                    else
                        pixelData.push(1);
                }
            }
        }

        onFinish(pixelData);
    };

    /**
     * Process the result of a FileReader.
     *
     * @param fileReader {FileReader} The file reader containing a result.
     */
    this.processFileReader = function (fileReader) {
        loadImage(fileReader.result);
    };

    /**
     * Process a canvas element.
     *
     * @param canvas {HTMLCanvasElement} The canvas element.
     */
    this.processCanvas = function (canvas) {
        loadImage(canvas.toDataURL());
    }
}

/**
 * Handle files upon selection. Will process the files and generate a dataset.
 *
 * @param imageElement {HTMLImageElement} An image element to render images to.
 * @param onFinish {Function} A function which will be called when the processing is finished. Will be given a single
 *                            parameter, the processed JSON data.
 * @constructor
 */
const FileHandler = function (imageElement, onFinish) {
    const handleFiles = function (files) {
        const fileReader = new FileReader();
        const imageProcess = new ImageProcess(imageElement, data => finishFile(data));
        const images = []
        let index = 0;

        const createImageJSON = (pixelData, className) => {
            const imgJSON = {
                input: pixelData,
                output: {}
            }
            imgJSON["output"][className] = 1;

            return imgJSON;
        }

        const handleFile = function () {
            if (index < files.length) {
                fileReader.readAsDataURL(files[index]);
            } else {
                onFinish(images);
            }
        }

        const finishFile = function (pixelData) {
            const className = files[index].name.split(".")[0];
            images.push(createImageJSON(pixelData, className));

            index += 1;
            handleFile();
        }

        fileReader.onload = () => imageProcess.processFileReader(fileReader);

        handleFile();
    }

    /**
     * Processes the files obtained through the given event.
     *
     * @param files {[File]} The event.
     */
    this.onSelectFiles = function (files) {
        handleFiles(files);
    }
}

/**
 * Creates an onChange handler for the given element.
 *
 * @param element {HTMLInputElement} The element which handles the files.
 */
FileHandler.prototype.createHandler = function (element) {
    element.addEventListener("change", evt => this.onSelectFiles(evt));

}

/**
 * DropArea handles file drops in the drop-area element.
 *
 * @param dropElement {HTMLInputElement} The element to listen to.
 * @param onDrop {Function} A function that is called when files are dropped.
 * @constructor
 */
const DropArea = function(dropElement, onDrop) {
    const _dropArea = dropElement;
    let _dropInput = null;

    const preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const addHighlight = (e) => {
        _dropArea.classList.add("highlight")
    };

    const removeHighlight = (e) => {
        _dropArea.classList.remove("highlight")
    };

    const handleDrop = (e) => {
        const dataTransfer = e.dataTransfer;

        onDrop(dataTransfer.files);
    };

    const init = function () {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(
            eventName => _dropArea.addEventListener(eventName, preventDefaults, false));

        ['dragenter', 'dragover'].forEach(
            eventName => _dropArea.addEventListener(eventName, addHighlight, false));

        ['dragleave', 'drop'].forEach(
            eventName => _dropArea.addEventListener(eventName, removeHighlight, false));

        _dropArea.addEventListener("drop", handleDrop, false);

        _dropInput = _dropArea.getElementsByClassName("drop-input").item(0);

        _dropInput.addEventListener("change", (evt) => onDrop(evt.target.files));
    };

    init();
};

/**
 * The emote object contains the main code for the website.
 *
 * @constructor
 */
const Emote = function () {
    const statusElement = document.getElementById('stats');
    const outputElement = document.getElementById("output");
    const svgOutputElement = document.getElementById("svg-output");
    let network = null;
    let drawingCanvas = null;
    let trainingData = null;
    let testData = null;
    let layers = null;
    let errorThreshold = null;
    let iterations = null;
    let networkChanged = true;
    let useGpu = true;

    const clearOutput = function () {
        document.getElementById('stats').innerHTML = "";
        document.getElementById('output').innerHTML = "";
    };

    /**
     * Train the network.
     */
    this.train = function () {
        if (trainingData == null || trainingData.length <= 0) {
            statusElement.innerHTML = "Geen train data!";
            return;
        }

        if (network === null || networkChanged) {
            try {
                network = new Network(layers, errorThreshold, iterations);
            } catch {
                statusElement.innerHTML = "Error tijdens het trainen!";
            }
        }
        else
            return;

        clearOutput();

        statusElement.innerHTML = "Netwerk aan het trainen...";
        document.body.style.cursor = "wait";

        try {
            let stats = network.train(trainingData);
            document.body.style.cursor = "unset";
            statusElement.innerHTML = JSON.stringify(stats, null, 2);

            // promise.then((item) => {
            //     document.body.style.cursor = "unset";
            //     statusElement.innerHTML = JSON.stringify(stats, null, 2);
            //     // "Stats: error=" + stats.error.toString() + " iterations=" + stats.iterations.toString();
            //
            //     networkChanged = false;
            // });
            // promise.catch((error) => {
            //     statusElement.innerHTML = "Error tijdens het trainen!\n" + error.error;
            //     document.body.style.cursor = "unset";
            // })
        } catch {
            statusElement.innerHTML = "Error tijdens het trainen!";
            document.body.style.cursor = "unset";
        }
    };

    /**
     * Test the network, using the test data.
     */
    this.test = function () {
        if (testData == null || testData.length <= 0) {
            outputElement.innerHTML = "Test mislukt. Geen data om te testen!";
            return;
        }
        if (network == null) {
            outputElement.innerHTML = "Netwerk is nog niet getraind."
            return;
        }

        clearOutput();
        const prediction = network.test(testData);

        // TODO: maybe split the outputs without using <br>
        outputElement.innerHTML = new Date().toLocaleTimeString("nl-NL") + " " +
            "Test resultaat: <br/>" + JSON.stringify(prediction.likely) +
            "<br/>Hoogste uit:" + JSON.stringify(prediction.run);
    };

    /**
     * Clears the DrawingCanvas.
     */
    this.clearBoard = function () {
        drawingCanvas.clear();
    };

    /**
     * Generates test data from the DrawingCanvas.
     */
    this.processBoardData = function () {
        const ip = new ImageProcess(document.getElementById("test-image"), (data) => {
            testData = data;

            dataToString([testData], (str) => {
                document.getElementById("test-data").innerHTML = str;
            });

        });

        ip.processCanvas(drawingCanvas.getCanvas())
    };

    // TODO: make async
    const dataToString = function (passedObj, onFinish) {
        const worker = new Worker("js/stringify.js");

        worker.onmessage = function (e) {
            onFinish(e.data);
        };

        worker.postMessage({"message": "stringify", "data": passedObj});
    };

    const init = function () {
        window.addEventListener('load', (event) => {
            console.log('page is fully loaded');
            drawingCanvas = new DrawingCanvas(document.getElementById("drawing-canvas"), 64, 64);

            // Create test drop area
            const fileHandlerTest = new FileHandler(document.getElementById("test-image"),
                (dataList) => {
                            if (dataList.length < 1)
                                console.error("Incorrect size data");
                            else if (dataList > 2)
                                console.warn("Only the first entry will be used");

                            testData = dataList[0]["input"];

                            dataToString([testData], (stringified) => {
                                document.getElementById("test-data").innerHTML = stringified;
                            });
                        });
            new DropArea(document.getElementById('test-files-drop'),
                (evt) => fileHandlerTest.onSelectFiles(evt));

            // Create train drop area
            const fileHandlerTrain = new FileHandler(document.getElementById("train-image"),
                (dataList) => {
                    trainingData = dataList;
                    document.body.style.cursor = "wait";
                    document.getElementById("train-data").innerHTML = "";

                    dataToString(dataList,
                        (data) => {
                            document.getElementById("train-data").innerHTML = data;
                            networkChanged = true;
                            document.body.style.cursor = "unset";
                        });
                });
            new DropArea(document.getElementById('train-files-drop'),
                (evt) => {
                    document.body.style.cursor = "wait";

                    fileHandlerTrain.onSelectFiles(evt);
            });

            // Create listeners for settings
            document.getElementById('layers').addEventListener("change", (evt) => {
                layers = JSON.parse(evt.target.value);
                networkChanged = true;
            });

            document.getElementById('errorThresh').addEventListener("change", (evt) => {
                errorThreshold = JSON.parse(evt.target.value);
                networkChanged = true;
            });

            document.getElementById('iterations').addEventListener("change", (evt) => {
                iterations = JSON.parse(evt.target.value);
                networkChanged = true;
            });

            document.getElementById("gpu").addEventListener("change", (evt) => {
                useGpu = document.getElementById("gpu").value !== 0;
                networkChanged = true;
            })

            // Load current settings
            layers = JSON.parse(document.getElementById('layers').value);
            errorThreshold = JSON.parse(document.getElementById('errorThresh').value);
            iterations = JSON.parse(document.getElementById('iterations').value);
            useGpu = document.getElementById("gpu").value !== 0;
        });
    };

	this.showSVG = function()
	{
		if (network) {
			if (svgOutputElement.style.display === "none") {
                svgOutputElement.innerHTML=network.getSVG();
				document.getElementById("show-network-button").innerHTML= "Verberg Net";
                svgOutputElement.style.display="block"
			}
			else {
                document.getElementById("show-network-button").innerHTML= "Toon Net";
                svgOutputElement.innerHTML="";
                svgOutputElement.style.display="none";
			}
		}
	};

    init();
};

const emote = new Emote();
