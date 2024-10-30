const conf = new (require('conf'))()
import { blue, greenBright, yellowBright, red } from 'chalk'
function list () {
    const todoList = conf.get('todo-list')
    if (todoList && todoList.length) {
        console.log(
            blue.bold('Tasks in green are done. Tasks in yellow are still not done.')
        )
        todoList.forEach((task, index) => {
            if (task.done) {
                console.log(
                    greenBright(`${index}. ${task.text}`)
                )
            } else {
                console.log(
                    yellowBright(`${index}. ${task.text}`)
                )
            }
        })
    } else {
        console.log(
            red.bold('You don\'t have any tasks yet.')
        )
    }
}
export default list