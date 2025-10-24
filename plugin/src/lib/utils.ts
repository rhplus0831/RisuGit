export function setById(div: HTMLDivElement, id: string, value: string) {
    const item = div.querySelector(`#${id}`);
    if(item) {
        item.innerHTML = value;
    } else {
        console.log(`Cannot find ${id}`)
    }
}