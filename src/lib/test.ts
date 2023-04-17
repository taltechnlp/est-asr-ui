type WeightClasses = {
    [index: string]: number;
}
export const weights = {
    heavy: 900,
    light: 200,
    bla: {fine: "print"}
} as const satisfies {[index: string]: number;};

type Weights = typeof weights;

type WeightKey = keyof Weights;

type WeightValue = (typeof weights)[WeightKey]

function printClass(className: WeightKey) {
    //const name = className satisfies string as string;
    console.log("The class is" + className);
}

function printValue(className: WeightValue) {
    //const number = className satisfies number as number;
    console.log("The value is" + className);
}

printClass("heavy")
printValue(200)

