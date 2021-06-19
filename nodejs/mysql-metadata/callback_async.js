//  Asynchronous callback function

function download(url, callback) {
    setTimeout(() => {
        console.log(`Downloading ${url}...`);
        callback(url);
    }, 3000);
}

function process(picture) {
    console.log(`Processing ${picture}`);
}

let url = 'https://www.javascripttutorial.net/pic.jpg';
download(url, process)