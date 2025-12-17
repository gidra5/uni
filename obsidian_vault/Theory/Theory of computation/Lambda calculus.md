Лямбда исчисление определяется тремя конструкциями:
1. Переменная `x`, `y` и тд. 
2. "Абстракция", или функция/лямбда `fn x -> body`. Функции всегда объявляют одну переменную, которую можно использовать в теле функции. Тело функции распространяется максимально вправо, и ограничено лишь круглыми скобками. 
3. "Применение абстракции" или вызов функции, обозначаются двумя переменными подряд `x y`. Вызов функций лево-асоциативный, что значит `x y z = (x y) z` 

Для более краткой записи используется "синтаксический сахар" `fn x, y ... -> body = fn x -> fn y -> ... -> body` обозначающий функцию нескольких переменных. Перевод функций нескольких переменных в формат принимающий их "по одной" называется каррированием.

Данные конструкции определяют достаточно простой, но очень експресивный синтаксис. Доказано что эта система является еквивалентной машине Тьюринга.

Я даже уже представляю как описать конструкции структурного программирования в лямбда исчислении. Структурное программирование определяется так же тремя конструкциями:
1. Последовательность инструкций
2. Условный оператор, ака if statements 
3. While циклы.

Каждую из конструкций можно описать в лямбда исчислении по отдельности с помощью монад, булеанов и рекурсии.

При этом можно заметить, что функции с разными именами для параметра по сути одинаковые - всегда можно переименовать что бы они выглядели оданиково. Такое переименовывание в литературе называют альфа конвертацией (alpha-conversion), а сами функции считаются еквивалентными. Для наглядности можно заменить имена параметров индексами в теле функции, которые указывают насколько "далеко" функция, параметр которой должен быть поставлен на месте индекса. Например `fn x -> x` тогда можно записать например как `fn -> 0`, или `fn -> #0` что бы отличать эти индексы от обычных чисел.  В таком случае все еквивалентные функции записываются так же одинаково.

Функции можно вычислять, или просто "упрощать". Например выражение `(fn x -> x) y` упрощается до простого `y`, или же после вычисления этого выражения мы получаем `y`. Эта процедура вычисления выражений в литературе называется бета-редукция ([[Beta-reduction|beta-reduction]]). Когда в выражении больше нельзя выполнять подстановки, такое выражение считается нормальной формой начального. Обычно все выражения которые приходят к одной и той же нормальной форме считаются еквивалентными.

Так же можно заметить что выражения подобные `fn x -> f x` по сути еквиваленты самой `f`, потому что они просто "пробрасывают" параметр внутрь этой функции. Это в литературе называют эта-редукцией (eta-reduction). По сути описывает свойство функций, что если они для всех параметров дают один и тот же результат, то они еквивалентны. Функциональщики часто этим пользуются что бы было ещё сложнее читать что они написали... Это ведь так красиво писать `reduce list (+) 0` вместо более понятного `reduce list (fn acc, value -> acc + value) 0`.

Эта система позволяет определят алгебраические типы данных. Тоесть енамы, каждый вариант которого может держать несколько вложенных значений дополнительно. В расте самый приятный синтаксис дл объявления таких структур, поэтому вот пару примеров:

```rust
enum Expression {
  Value(i32),
  Product(Expression, Expression),
  Sum(Expression, Expression),
}

enum Color {
  Red,
  Green,
  Blue
}

enum Boolean {
  True,
  False
}

enum Integer {
  Zero,
  Successor(Integer)
}
```

Как такие значения можно определить в лямбда исчислении? Для начала определимся как репрезентовать такие значения можно. А для этого подумаем как мы хотим вообще использовать такие значения. В том же расте у нас есть match оператор, который выглядит вот так:

```rust
match boolean {
  True => 1,
  False => 0
}
```

Читается как *если переменная boolean держит вариант True, вернуть Successor(Zero), если False, то вернуть Zero*

Это поведение является определяющим для енамов.
Если убрать весь синтаксис по сути остаётся только `boolean`, `1` и `0`, которые надо как то скомбинировать и получить то же поведение.
Но так или иначе все эти значения должны быть функциями в рамках лямбда исчисления, а значит можем просто передать в `boolean` наши два значения, ведь он по сути определяется поведением относительно этих двух параметров. Тоесть еквивалентное этому метчу выражение будет выглядеть так `boolean 1 0`. 
Это уже что-то. Из этого можем вывести уже что `boolean` это функция двух переменных. И так можно описать все подобные енамы - "значения" такого типа выглядят как функции которые принимают по одному параметру на каждый вариант даного типа. Тогда если хотим получить желаемое поведение, то имеем что `true` это булеан который возвращает первый аргумент, а `false` - который возвращает второй:

```
true = fn trueMatch, falseMatch -> trueMatch
false = fn trueMatch, falseMatch -> falseMatch
```

Интуитивно я воспринимаю эти константы как "метчеры", потому что в рамках такого оператора как match они полностью выполняют его функцию. Из этой логики и вытекает репрезентация описанная выше. Эта репрезентация в википедии называется Mogensen–Scott encoding. Так же есть Church encoding, но она не носит такой же интуиции, как эта (но возможно я тупой просто).

А теперь рассмотрим такой метч с числом:

```rust
match integer {
  Successor(anotherNumber) => anotherNumber,
  Zero => Zero
}
```

Читается как *если число является следующим после другого числа, то возвращаем это другое число, если это ноль, то возвращаем ноль*. По сути возвращает integer - 1

В этот раз у нас всё выглядит немного иначе. У нас есть вариант `Successor` "содержащий" в себе другое число, которое мы достаем в соответствующей ветке. Раз уж мы не знаем какое число это должно быть и где его взять, эту ветку можно описать только функцией, которая принимает число из этого варианта енама. Тогда выражение в лямбда исчислении будет выглядеть так: `integer (fn anotherNumber => anotherNumber) zero`
Из этого имеем что значение `integer` так же должно иметь вид функции двух переменных, как и `boolean`, но с отличием что первый аргумент тоже всегда должен быть функцией. 
Со второй же веткой метча всё и так понятно, значение `integer` которое будет так работать выглядит буквально как `false` из предыдущего примера.

А вот что делать с веткой `Successor`? Откуда мы возьмём число что бы передать его в ветку? Ну для начала что бы создать значение этого варианта тоже нужно иметь число. Это не просто константа, это результат "конструктора" этого значения. Этот конструктор принимает число и отдает новое число. Звучит какраз как то чего нам не хватало, что бы описать метч второй ветки. Мы можем передать это число которое получили в конструкторе в соответственную ветку метча.
В таком случае варианты выглядят так:

```
successor = fn predecessor -> fn successorMatch, zeroMatch -> successorMatch predecessor
zero = fn successorMatch, zeroMatch -> zeroMatch
```

Следуя такой логике мы можем определить например кортежи (tuple)

Кортежи это тип данных с одним вариантом для метча и двумя параметрами нужных для его создания, которые метчер должен передавать. Следовательно "значения" это функции одного аргумента, и "конструктор" это функция двух аргументов, что имеет примерно такой вид:

`tuple = fn first, second -> fn matched -> matched first second`

Метчингом можно определить функции которые берут первый параметр их кортежа и второй соответственно:

```
first = fn tuple -> tuple (fn first, second -> first)
second = fn tuple -> tuple (fn first, second -> second)
```

И что интересно, метчеры в функциях `first`, `second` выглядят в точности как `true`, `false`, описанные ранее, тоесть их можно переписать так:

```
first = fn tuple -> tuple true
second = fn tuple -> tuple false
```

Имея эти все базовые блоки уже можно кучу всего полезного определить, например операции над числами (`add`, `sub`, `mult`, etc.), логику на булеанах (`and`, `or`, `not`, `xor`, etc.)

Дальше добавлю ещё немного сахара, что бы было компактнее:
1. `(a, b) = tuple a b`
2. `tuple[0] = first tuple, tuple[1] = second tuple`
3. `id = () = fn x -> x`
4. `0 = zero, 1 = successor zero, 2 = successor successor zero, ...`
5. `if bool then body1 else body2 = bool body1 body2`
6. `if bool then body1 = if bool then body1 else ()`

И в добавок к этому блок определений переменных: 
`{ x = v1; y = v2; result } = (fn x -> (fn y -> result) v2) v1`

Такие блоки так же позволяют "игнорировать" результат и "перекрывать" ранее обьявленные переменные:

`{ x = v1; v2; x = v3; ... } = (fn x -> (fn _ -> (fn x -> ...) v3) v2) v1`

Для монады надо определить две вещи - способ создания "монадных" значений `value` (или просто обёртка над обычными значениями) и способ мапать то что внутри в новое обернутое значение `flatMap`. Имея это, блоки кода можно "декорировать" такой монадой, и таким образом автоматически "разворачивать" значения внутри монад:

```
{ x = v1; y = v2; result } 
= flatMap (fn x -> flatMap (fn y -> result) v2) v1
```

Монады не панацея - они ожидают что так или иначе каждое выражение в последовательности возвращает уже обернутое значение, иначе `flatMap` не будет корректно работать. Даже `result` который наприямую не передается в `flatMap` должен быть обернут, потому что иначе `fn y -> result` не соответствует контракту.
Альтернативно, можно вводить новый оператор `unwrap` в таких блоках, который позволяет разворачивать значения:

```
{ x = v1; y = unwrap v2; result } 
= (fn x -> flatMap (fn y -> result) v2) v1
```

В таком случае мы убираем требование что все выражения должны возвращать обернутое значение, но теперь нужно явно разварачивать их.
Например допустим есть тип `Option` с вариантами `Some(x)` и `None`, определенными аналогично целым числам (без типов и имен параметров они буквально одинаковые).
Для того что бы option называть монадой достаточно определить `flatMap`, который будет мапать а потом выравнивать вложенные `Option`.

```
value = Some
flatMap = fn mapper, option -> option mapper None = fn mapper, option -> flat (map mapper option)
map = fn mapper, option -> option (fn value -> Some(mapper value)) None
id = fn value -> value
flat = fn option -> option id None
```

Концептуально маппер переданный в `flatMap` описывает "продолжение вычисления", а сама функция есть выполнение одного шага в этом вычислении.

Оператор для разворачивания часто можно автоматически вставлять на основе типов как вид каста - каждый раз когда ожидается параметр типа `Т`, а туда передается `Option<T>`, компилятор автоматически вставляет "каст" из `Option<T>` в `T`, таким образом разворачивая значение. При этом сама функция теперь будет возвращать результат обернутый в `Option<...>`, ведь если значения небыло то придется сделать early return. Если же значение обернуто в несколько монад, например `Promise<Option<T>>`, то компилятору придется вычислять последовательность кастов, или же пользователи сами должны будут указать каким то образом как кастовать `Promise<Option<T>>` в `T`.

Думаю достаточно легко найти сходство любой монады с классическими блоками кода. Но недостаток монад в том что они "красят" блоки кода в свой "цвет", и заставляют блоки которые их используют тоже становится того же цвета, потому что иначе не удобно (а иногда невозможно) пользоваться результатом такого выражения. В примере выше это было буквально видно - если блок хочет "развернуть" значение из монады, то результирующее значение тоже станет обернутым в монаду, и теперь если получатель значения хочет без усложнений в виде явной обработки возможных кейсов воспользоваться результатом, его результат тоже будет обернут в `Option<...>`.

С помощью монад можно реализовать стандартный блок кода с `break` оператором, который позволяет выйти из блока раньше чем он закончится. Этот оператор будет принимать значение, которое будет считаться результатом блока. И так же блоки кода должны позволять определить переменные инициализированные некоторым значением на время жизни блока. Такие конструкции позволяют определить базовый control flow в выражении.
Какая монада позволит нам такое реализовать? Ну давайте опишем результат каждого шага в таком блоке в виде енама:

```
enum BlockState {
	Next(value),
	Break(withValue)
}
```

Можно сказать мы каждую из команд доступных в блоке шифруем в виде одного из вариантов енама со всеми данными требуемыми для выполнения этой команды.
И как мы помним такой енам конвертируется в следующие конструкторы:

```
BlockState_Next = fn value -> fn nextMatch, breakMatch -> nextMatch value
BlockState_Break = fn withValue -> fn nextMatch, breakMatch -> breakMatch withValue
```

Но эта штука должна быть монадой, что бы мы ее могли использовать с выше описаным синтаксисом, а значит определяем `value` и `flatMap` для него:

```
value = BlockState_Next
flatMap = fn mapper, blockState -> blockState mapper id
```

По сути логика такова получается:
- Если `blockState` это `break`, то возвращаем то что лежало внутри
- Если `blockState` это `next`, то продолжаем цепочку вычислений с тем что лежало внутри

Если сделать алиас `break = BlockState_Break`, то поведение будет выглядить почти как в Rust:

```
{ 
	x = v1; 
	y = v2; 
	if y then break result2 else value ();
	result 
} = flatMap (fn x -> flatMap (fn y -> flatMap (fn _ -> result) (if y then break result2 else value ())) v2) v1
```

Если же проводить анализ каждого выражения, и добавлять обертку в `value` где ее нету, что бы приводить результаты всех выражений к единому интерфейсу, то приходим к виду как в Rust: 

```
{ x = v1; y = v2; if y then break result2; result } = 
	flatMap (fn x -> flatMap (fn y -> flatMap (fn _ -> result) (if y then break result2 else value ())) v2) v1
```

Теперь перейдем к тому как можно реализовать циклы в подобной системе. Разсмотрим следуйщий пример из Python:

```
while test_condition():
    do_stuff()
```

Выглядит просто? Впринципе да. Но в примере `test_condition` и `do_stuff` это функции, которые вызываются и вероятно меняют какое то общее состояние, иначе это достаточно бесполезный цикл, который или вечный или вообще никогда не запускается. Сделаем это общее состояние явным:

```
while test_condition(state):
    state = do_stuff(state)
```

При этом ожидается, что теперь `test_condition` и `do_stuff` не имеют общего состояния где то вне этого блока - всё состояние которое они требуют передается им явно и `test_condition` возвращвает условие, а `do_stuff` новое состояние. Даже если `test_condition` изначально тоже делает часть изминений в состоянии всегда можно разбить на две части его - одна которая вычисляет только условие, и вторая которая делает все изминения в состоянии.
Запишем в виде функции в лямбда исчислении:

```
while = fn condition, body -> fn state ->
	if (condition state) 
	then while condition body (body state)
	else state
```

Хм... виднеется проблема. Наше определение вызывает самого себя, хотя по факту лямбда исчисление не позволяет вот так просто ссылаться на определяемую функцию. Но по сути это всеравно что если бы функция ещё одним аргументом принимала "саму себя", и мы просто сразу на месте дали ей копию себя. И эту конструкцию даже можно абстрагировать в отдельную функцию, что бы не приходилось дублировать тело основной функции. В реальности выглядит примерно так:

```
pass_self = fn f -> f f
while = fn condition, body -> 
	pass_self (
		fn self -> fn state ->
			if (condition state) 
			then self self (body state)
			else state
	)
```

Хотя этого впринципе достаточно для функционирования, это не очень красиво выглядит, ведь всеравно приходится в теле передавать самого себя, хотелось бы принимать self с уже переданным самим собой, тогда можно более менее прямо описывать рекурсию. Для этого можем добавить ещё одну вспомогательную функцию, и тогда реализация становится максимально чистой:

```
pass_self_clean = fn f -> pass_self (fn self -> f (self self))
while = fn condition, body -> 
	pass_self_clean (
		fn self -> fn state ->
			if (condition state) 
			then self (body state)
			else state
	)
```

В итоге сама функция принимае три параметра - условие, тело, и начальное общее состояние между ними двумя.
Утилита `pass_self_clean` которая в итоге получилась имеет имя Y-combinator или fixed-point combinator, и обычно обозначается `fix`. Первое имя на самом деле не представляю кто придумал, а второе уходит корнями в математику. 
Данный комбинатор по сути определяет значение `x` (фиксированную точку функции `f`), для которой справедливо равенство `x = f x`, тоесть даже если ещё раз применить переданную функцию к результату, мы просто получим тоже самое. 
В рамках while оператора это означает что на выходе мы всегда получаем `state` для которого тело оператора возвращает это же состояние, что как видно из реализации возможно только если условие для цикла уже недействительно.

Вместе с этим можно считать, что мы реализовали основные примитивы структурного програмирования, так привычные с императивных языков.

Дальше я планирую так же описать типизированное лямбда исчисление на основе исчисления конструкций, где мы пройдемся по всем этим конструкциям и дадим каждой из них тип. Сразу как только я пойму как это дерьмо вообще должно работать.

PS. в качестве бонуса: тип чисел который был определен почти в самом начале `Integer` по сути является фиксированной точкой для `Option<T>`, что станет видно если провернуть то, что мы сделали с `while`, с `Integer`.

PSS. А можно ли определить как то взаимно рекурсивные функции? Да, можно. По сути сводится к тому что бы определить вариант енама под каждую функцию которую мы хотим иметь возможность рекурсивно вызывать. Класический пример - пара функций `even` и `odd`:

```
even = fn n -> if n = 0 then true else odd (n - 1)
odd = fn n -> if n = 1 then true else even (n - 1)
```

Что бы определить не взаимнорекурсивные функции достаточно сделать одну общую функцию, которая принимает доп параметр, по которому определяет какую из двух функций выполнять:

```
var_even = fn matchEven, matchOdd -> matchEven
var_odd = fn matchEven, matchOdd -> matchOdd
even_or_odd = fix (fn self -> fn variant -> 
	variant 
		(fn n -> if n = 0 then true else self var_odd (n - 1)) 
		(fn n -> self var_even (n - 1))
)
even = even_or_odd var_even
odd = even_or_odd var_odd
```

Или альтернативный вариант с кортежами:

```
(even, odd) = fix (fn (even, odd) -> (
		fn n -> if n = 0 then true else odd (n - 1),
		fn n -> even (n - 1)
	)
)
```

prepend to tuple:
```
prepend = fn x, tuple -> fn match -> tuple match x
```
append to tuple:
```
append = fn tuple, x -> fn match -> tuple (match x)
```
tuple of certain size:
```
tuple_n = fn n -> fn x -> n (fn sub_n -> append x (tuple_n sub_n)) (fn -> x)
```

tuple nth:
```
drop = fn n, x -> if n=0 then x else fn _ -> drop (n-1) x
nth = fn tuple, size, n -> tuple drop n (fn x -> drop (size-n-1) x)
```
tuple head and tail:
```
tail = fn tuple, n -> tuple (fn _ -> tuple_n (n-1))
head = fn tuple, n -> nth tuple n 0
head_and_tail = fn tuple, n -> (head tuple n, tail tuple n)
```
tuple insert:
```
insert = fn tuple, size, n, x -> 
	if n=0 
		then prepend x tuple 
		else prepend (head tuple size) (insert (tail tuple size) (size-1) (n-1) x))
```

Одно интересное свойство:
```
{
	a(1, 2, 3)
	...rest
} -> a: (int, int, int) -> void
```
Тоесть если результат вызовы функции не используется в блоке никак, то он может быть `void`, ака `bottom type`.

Если десугарнуть блок кода, имеем:
```
(_ -> ...rest) (a(1, 2, 3))
```
Тоесть аргумент игнорируется, а значит он может быть как типа `void` так и типа `unknown`, ака `top type`.

В каком то смысле значением типа `void` может быть только пустой блок кода `{}` - значение которое нельзя пытаться использовать, его можно только проигнорировать.

```

apply_tuple = fn f, n -> match n 
	0 -> f ()
	sub_n -> fn x -> apply_tuple (fn rest -> f (prepend x rest)) sub_n

rotate = fn tuple, len -> 
	prepend (drop len-1 tuple) (nth tuple len (len-1))

rotateFn = fn f, len -> apply_tuple (fn args -> rotate args n f) n

```

https://www.reddit.com/r/ProgrammingLanguages/s/WduQW0IUwS

https://www.typescriptlang.org/play/?#code/C4TwDgpgBAMghgLxAHgCoD4oF4oAoCU2mqA3AFCiRQBCA9rQDbZRrq7ABcsiKGhWmZADE2AMy7wkw9P2JQAPlCHkyAY1oA7AM7AoAfWAAnAK4QudRs3ay8om8ALl123XtFwGWszXpMc1olsbUUcyNU0dKDgNABMrBgALLXNfABooQySUxhtErVwCQMytfAKbNw8vfCcI3VpDeKyfRnTi7IZcpLLAgxMIUsKBDKTqsOdIgEtRVASIDQBRT2gcNHSRXGcY9vTgACMJHlZ00X3uKREbTfZd0pPRsgB6B6hx3TgAc0MICDicXtNyE8XrUosZgLNfvojADHs9XlAAB7MKYzOaLLy4WFQbHRGK4D5fH7pOBgiH4VJY7GDTAAb0p2OB2kYEAAdAxaO9cAAiEngn5RWJRT7fGJc0ZAhkZCDAYyGDRQADkIAgWgV9IAvhSJXgbHTtdjxsy2RzuRpaG9Sfz6lAzW9hT8xYDnpKvjK5VAAIwarXPe6UaCoYxgBgQNAe9KoABMmBWACU2ABbODAVQJLj4riocNQU5Rmyx-MqeEy4PLMjY5DwrPpKvRjNQas5zOR-CZoMhsMR6NEct4JMphKyXvY-up-HpG41FxQUQTQyRFaNqNsEshtulzsN6P2dsQApwCc2OCjeFeTbMTfL9i79cdpfbwKrvfjnM2SdhIHwpE4J+4bNcyNHSxL8PWYWd5wcBFxThEEEUjZgz00PEoPIf0oAAQQAEVQAA1OBDAmaJgAAZVTCAE2WKBjA0ABrM0AHcNAAbQAXVQ8BoCw1BSNmCjmC4vCCKInjyIgVj2KoLiAFlkzI+dkF7ES+IgBFgDmGItAw7ClIgClsVQTSVLU2JNOoujaEY1iKRjKAdKgIz1M0pjewmDRRAgBoAAkIDgOIHJMrTcPwwiNBIsiKL0qAWWi1z3IaWMVV0fyNMCnSKRY3sAH4oGcyUqWill8PeZIoG83ybAMpiAAYWMiyUCuk2TZnkhKdAjQzVMcnKzIYjR0gK2KPKgVrgFQFioGykbUCgLhWPQOqoAy7FZrYigOMCvCGFMZA7OSzSuJ0my0A64yUp6izmJYthewKgA3YKiJKxqBw8rQdvC3SGy0dAyAqrQmI0YwE12DzVrWyTdh0Qw4FUEiQFCuAEVQQl+Owzbtt7XKGQeAAqKB7qE3YQygHHngBuAKK4KHXPeWrhygXGoAYCndhiOASbJjQKe8amNHeCdaBiEAuHQyGjBhuGEaRwk6clRm4DAYMJlUZMJk0DmctEDQRbF6HYeI+HgER5HvmJQx3h1qGJYNqWTYgWXFrIdAixBAnCKJssqS5ymoF595Www3XrcN42UYEXtVmuyVbvTb2eaMGmKoWhhY+5qmE75gWhct8X9ZD6Xvhsc7GIWuB0y1nO9clo2C8+orK+D23CSL2jesiodo9wOP7nhZngbZ7Bey7tPfYz-mc0F4XA6tvOm8LhvZ5ru2ewrVBUijhkY7wOP04IvmW-Mkv6ZT7eR79rOp9Fmfq9DwvAjX+my9sbXp9zm-a7Ni3X6rm2l+bwJi59V7B3BkDBh4RQnkLHuIIFZKxVsANW8osBDwrt-Ruf9TZRHNgvd+dsA5Xzfr-W+ywfqr3XpiaOqcfZ+wPm3Y+VD4573HrsSeOCiG11oRdUu5cX4EJ-vnO2n82ECP-kMB+2IQE4lwFrT+0DpyjgSOhBcQ84A6GEXPfoK8WBrw3tiLe4DGGJ3vsnBhu8aYX3URgzRYjuHP0scQoRaDF7EKTsAzMWicQ6GQExNeDYIxXVwLddIDBiRyMiKo3QOBYEMGVqrTQFCmYszZtyBEXJiSKxifAxBgSHoexSWKdIbs4B5K5AgMU+ByS9iKSUkABTfou2nH7KYIArARPsRwsxfMtEKKUQ4CJpR6YGJsHHBaBiL42AAAYABIaRx3VFAAAtJgGZTTRAgFwCwqB6oJmjJkVg-2gQ6R5UZJEPQRVmBFW8efUeTD0h+wCfTSUQzAgjMeQyakUAJm4BWWPZp+Jzb4HVPgHZbyqQ2FWesoqlTjmjGOfCNwSCZwaCuWPO5qKbk0weccr23NhncwWk8yZ3yaQQukRoQFwKCXvPBb8tZZLoV5VhXlV0sp5TTJpAi+ZMyznm22eQSUmpgENMiOoBMYAwSUQSW0pxuDCSRTjiVBK6hDAxGQNcvh6DiE2RpIK-BQdnG126U1Xp+IdADKed3QIBioCuRtNzTS2UFXkwouNLg1SQxDIZTiiBmyQC6jefCGkOU44sS4Hofq0UviRHmTgBV-K8rwt9cwUV4q1IbMnq0RKTKXTSlZYk-ucAxn6F9dmqAgqnl7KhYcgNIIEXJtoGKiVZL0gKtLQaWt5ycApqbUVFt9q21SjdPKHpOhcAIvNdi55QxomxIQfE91e5u7pB5f7Kl3rPolsCN2tNvr0hBoKgq9Izr7ZhvOUCtdOpAgzqyfE7de4EV9ooiUZdUKqWlvLVAMJRp2SclJf0k8ERv0mlJXe01wAKmjCAA

https://www.reddit.com/r/ProgrammingLanguages/s/Ygx3YlGa37
https://www.reddit.com/r/ProgrammingLanguages/s/N0EcYV8N5U

https://gregfjohnson.com/pred/