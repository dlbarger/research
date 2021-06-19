//  Callback Examples

let numbers = [1,2,3,4,5,6,7,8,9,10]

const oddNumbers = numbers.filter(isOddNumber);
console.log(oddNumbers)


function isOddNumber(number) {
    return number % 2;
}
