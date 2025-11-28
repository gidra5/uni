Позволяет описывать конкурентные вычисления.

В пи исчислении существуют следующие конструкции:
1. Переменная `x`, `y` и тд. 
2.  "Канал" - `ch x -> body`. Определяет канал связи между двумя паралельными процессами, где один процесс есть получателем данных, а второй отправителем.
3. "Получение данных" - `x[y] -> body`. Ожидает данных из канала `x`, которые отправит продюсер и выполняет `body` с данными которые пришли.
4. "Отправка данных" - `x(y) rest`. Ждет пока получатель примет данные через канал `x`, и потом выполнить `rest`.
5. "Одновременное выполнение" - `x | y`. Выполняет `х` и `у` "одновременно".
6. "Нулевой процесс" - `0`. Процесс который уже закончился.
7. "Сумма процессов" - `x + y`. Процесс, который выбирает один из процессов `x` или `y` для продолжения вычисления.

https://www.pure.ed.ac.uk/ws/portalfiles/portal/18383989/Wadler_2012_Propositions_as_Sessions.pdf
https://arxiv.org/pdf/1802.02917

https://www.cs.cmu.edu/afs/cs.cmu.edu/user/fp/www/papers/mscs13.pdf
http://reports-archive.adm.cs.cmu.edu/anon/2015/CMU-CS-15-109.pdf

https://dl.acm.org/doi/pdf/10.1145/3678232.3678234
http://www.cs.cmu.edu/~fp/papers/esop13a.pdf
https://drops.dagstuhl.de/storage/00lipics/lipics-vol042-concur2015/LIPIcs.CONCUR.2015.412/LIPIcs.CONCUR.2015.412.pdf
coherence as generalization of duality.
https://arxiv.org/pdf/2102.04731
coherence through arbiters

https://web.archive.org/web/20240426090831/https://dmg.tuwien.ac.at/aschieri/popl-clinear.pdf
https://arxiv.org/pdf/2205.15203
Sub-Term Property

https://web.archive.org/web/20250304101804/https://nicolaspouillard.fr/publis/ptt1.pdf

https://cris.unibo.it/bitstream/11585/957052/1/main.pdf

https://www.doc.ic.ac.uk/~dorchard/publ/popl16-orchard-yoshida.pdf?utm_source=chatgpt.com
effect systems as ambients for mobile processes.
modality as generalization of linearity

a semantics, where effect handlers are separate processes, accessed through a channel implicitly passed down the call stack. does this semantics simplify implementation by essentially avoiding non trivial escaping of stack fragments?



Так же из семантики вытекают следующие тождества:
* `x | y === y | x` - комутативность
* `(x | y) | z === x | (y | z)` - асоциативность
* `ch x -> (y | z) === (ch x -> y) | z` если `x` не используется в `z`
* `x | 0 === x`
* `x + y === y + x`
* `(x + y) + z === x + (y + z)`
* `x + 0 === x`

## Редукция
Выражения можно упростить следуя следующим правилам:
* `w + (x[y] -> A) | (x(z) B) + v => A[y=z] | B` 
* Если `A => B` то и `A | C => B | C`
* Если `A => B` то и `ch x -> A => ch x -> B`
* Если `A => B`, `A === A'`, `B === B'` то и `A' => B'`

Можно сказать данное исчисление моделирует паралельные системы как набор потоков, которые передают друг другу данные пользуясь некоторым каналом передачи данных. 

Данное исчисление может описывать класическое лямбда исчисление:
* `fn x -> body === ch fn -> fn[x] -> fn(body)` - принимает аргумент и сразу отдает результат обратно.
* `x y === ch fn -> x | fn(y) fn[body] -> body` - передает аргумент и сражу ожидает ответ.

Можно сделать гибрид лямбда исчисления и пи исчисления используя такие конструкции:
1. Переменная `x`, `y` и тд. 
2. "Абстракция", или функция/лямбда `fn x -> body`. Функции всегда объявляют одну переменную, которую можно использовать в теле функции. Тело функции распространяется максимально вправо, и ограничено лишь круглыми скобками. 
3. "Применение абстракции" или вызов функции, обозначаются двумя переменными подряд `x y`. Вызов функций лево-асоциативный, что значит `x y z = (x y) z` 
4.  "Канал" - `ch`. "Создает" уникальный канал для передачи данных между двумя паралельными процессами.
5. "Получение данных" - `x.receive fn y -> body`. Ожидает данных из канала `x`, которые отправит продюсер и вызивает переданную лямбду с полученными данными.
6. "Отправка данных" - `x.send y rest`. Ждет пока получатель примет данные через канал `x`, и вернет `rest`.
7. "Одновременное выполнение" - `x | y`. Выполняет `х` и `у` "одновременно".
6. "Нулевой процесс" - `void`. Процесс который уже закончился. Так же можно интерпретировтаь как значение которое нельзя использовать как функцию или аргумент.
7. "сумма процессов" - `x + y`. Выбирает лишь один из процессов для продолжения выполнения.

Правила редукции тогда таковы:
1. `(fn x -> A) y => A[x=y]`
2. `fn x -> f x => f`
3. `(сh#n.send A B) | (сh#n.receive fn x -> C) => B | C[x=A]`
4. `A | void => A`
5. `A + void => A`
6. `A | B => A | C` если `B => C`
6. `A + B => A + C` если `B => C`
7. `A (B | C) => (A B) | (A C)`
8.  `(A | B) C => (A C) | (B C)`
9.  `(fn x -> A) ch => A[x=ch#n]`, где `n` это уникальный номер канала
10. `fn x -> (A | B) => A | fn x -> B` если `x` не используется в `A`
11. `(E + (сh#n.send A B)) | ((сh#n.receive fn x -> C) + F) => B | C[x=A]`
12. `A (B + C) => A B + A C`
13. `(A + B) C => A C + B C`
14. `A void => void`
15. `void A => void`
https://en.wikipedia.org/wiki/Flynn%27s_taxonomy

Можно заметить, что каналы и функции дуальны - если фокусироваться на получателях и отправителях в вычислениях, то будем иметь функции, передача данных в которые есть атомарным действием. Если же фокусироваться на передаче данных как на атоме, то будем иметь каналы, в которых получатели и отправитель в некотором вычислении разделены и независимы теперь, и лишь само действие передачи данных атомарно.

Примеры таких выражений и их редукций:
1. `(fn x -> (x.receive fn y -> y 2) | (x.send (fn z -> z + 1) 0)) ch`
	`(ch#0.receive fn y -> y 2) | (ch#0.send (fn z -> z + 1) 0)`
	`((fn z -> z + 1) 2) | (0)`
	`(fn z -> z + 1) 2)`
	`2 + 1`
	`3`
2. `(fn x -> (x.receive fn y -> x.send (y 2) ((y 3) * 2)) | (x.send (fn z -> z + 1) (x.receive fn x -> x * 2))) ch`
	`(ch#0.receive fn y -> ch#0.send (y 2) ((y 3) * 4)) | (ch#0.send (fn z -> z + 1) (ch#0.receive fn x -> x * 2))`
	`ch#0.send ((fn z -> z + 1) 2) (((fn z -> z + 1) 3) * 4) | ch#0.receive fn x -> x * 2`
	`(((fn z -> z + 1) 3) * 4) | ((fn z -> z + 1) 2) * 2`
	`(3 + 1) * 4 | (2 + 1) * 2`
	`4 * 4 | 3 * 2`
	`16 | 6`
3. `(fn w -> w * w) ((fn x -> (x.receive fn y -> x.send (y 2) ((y 3) * 2)) | (x.send (fn z -> z + 1) (x.receive fn x -> x * 2))) ch)`
	`(fn w -> w * w) (16 | 6)`
	`((fn w -> w * w) 16) | ((fn w -> w * w) 6)`
	`16 * 16 | 6 * 6`
	`256 | 36`

В такой формулировке вычисление выражений является недетерменированным процессом, что усложняет анализ.
Может получится так что надо выбирать между множеством получателей и отправителей, и так как все процессы равноправные, то этот выбор случаен, а значит и вся программа недетерменировання
Что бы избежать такой ситуации можно поставить ограничение - конец канала может иметь лишь один процес-владельца. В этом случае легко отследить кто получит, а кто отправит данные, и вычисление такого выражения становится детерменированым.
Альтернативный вариант внести детерменизм - определить процедуру выбора пары отправитель-получатель. Но тогда это может нарушить поедположение "равноправия" между процессами.
Иногда этот недетерменизм можно нигилировать сбором через комутативные операции, у которых результат не зависит от порядка значений
Например сумма значений все процессов всегда одна и та же, независимо от того кто когда закончил, зависит только от их отдельных значений.

Редукции между паралельными частями могут выполняться в любом порядке.
На самом деле такое поведение исходит из асоциативности паралельных процессов, тк иначе мы должны выбирать когда и какой поток получит\отправит данные, а какой нет, что может привести к разным результатам.
Таким образом комуникации между потоками являются точками синхронизации, тк перед тем что бы мы могли продолжить упрощать то что будет дальше, нам нужно дождаться что бы процессы или получили или отправили данные через канал.
При этом правила 5, 6 по сути являются следствиями дистрибутивности для операций вызова функции и паралельных вычислений.
Получается что для этой пары операций работают все законы знакомые с арифметики: дистрибутивность, комутативность, асоциативность.
Мы знаем что существует left identity `fn x -> x` для операции вызова, но несуществует правой единицы, увы.

Данный механизм может позволить например реализовать класический async\await без разукрашивания функций, как это в JS или Rust:

Пример работы такого асинк авейта:
```
{
  f = async fn x -> x + 1
  g = fn x -> x * 2

  x = f 2
  y = async g 3
  z = 3 + 1

  z + await y + await x
}
=> 
{
  f = fn x -> x + 1
  g = fn x -> x * 2

  | ch#0.send (f 2) void 
  | ch#0.receive fn x -> {
    y = async g 3
    z = 3 + 1

    z + await y + x
  }
}
=> 
{
  f = fn x -> x + 1
  g = fn x -> x * 2
  
  | ch#0.send (f 2) void 
  | ch#0.receive fn x -> 
    | ch#1.send (g 3) void 
    | ch#1.receive fn y -> {
      z = 3 + 1
      z + y + x
    }
}
=> 
{
  f = async fn x -> x + 1
  g = fn x -> x * 2
  
  | ch#0.send (f 2) void 
  | ch#1.send (g 3) void 
  | ch#0.receive fn x -> 
    | ch#1.receive fn y -> {
      z = 3 + 1
      z + y + x
    }
}
```

```
{
  f = async fn x -> x + 1
  x = f 2
  y = 3 + 1
  z = async fn w -> w * await x

  y + await (z 2)
}
```

Корутины:
```
{
  x := fn -> {
    yield 1;
    y := yield 2;
    y * 2
  }
  a := x()
  b := x()
  c := x 3
  a + b * c
}
=>
{
  ch#0.send ()
  a := ch#0.receive
  ch#0.send ()
  b := ch#0.receive
  ch#0.send 3
  c := ch#0.receive
  a + b * c
} | {
  ch#0.receive
  ch#0.send 1
  ch#0.receive
  ch#0.send 2
  y := ch#0.receive
  ch#0.send y * 2
} 
=>
{
  a := ch#0.receive
  ch#0.send ()
  b := ch#0.receive
  ch#0.send 3
  c := ch#0.receive
  a + b * c
} | {
  ()
  ch#0.send 1
  ch#0.receive
  ch#0.send 2
  y := ch#0.receive
  ch#0.send y * 2
} 
=>
{
  a := 1
  ch#0.send ()
  b := ch#0.receive
  ch#0.send 3
  c := ch#0.receive
  a + b * c
} | {
  ch#0.receive
  ch#0.send 2
  y := ch#0.receive
  ch#0.send y * 2
} 
=>
{
  a := 1
  b := ch#0.receive
  ch#0.send 3
  c := ch#0.receive
  a + b * c
} | {
  ()
  ch#0.send 2
  y := ch#0.receive
  ch#0.send y * 2
} 
=>
{
  a := 1
  b := 2
  ch#0.send 3
  c := ch#0.receive
  a + b * c
} | {
  y := ch#0.receive
  ch#0.send y * 2
} 
=>
{
  a := 1
  b := 2
  c := ch#0.receive
  a + b * c
} | {
  y := 3
  ch#0.send y * 2
} 
=>
{
  a := 1
  b := 2
  c := ch#0.receive
  a + b * c
} | {
  ch#0.send 3 * 2
}
=>
{
  a := 1
  b := 2
  c := 3 * 2
  a + b * c
} | {} 
=>
{
  a := 1
  b := 2
  c := 3 * 2
  a + b * c
}
```

Функции:
```
{
  x := fn x -> x * 2
  2 * x 5
}
=>
{
  ch#0.send 5
  2 * ch#0.receive
} | {
  x := ch#0.receive
  ch#0.send x * 2
}
=>
{
  2 * ch#0.receive
} | {
  x := 5
  ch#0.send x * 2
}
=>
{
  2 * ch#0.receive
} | {
  ch#0.send 5 * 2
}
=>
{
  2 * 5 * 2
} | {}
=>
{ 10 * 5 }
```

Оператор `|` достаточно удобен в такой интерпретации - позволяет нативно описывать подобие множеств (set) или случаи когда может быть несколько вариантов значений, как в юнионе типов.
  

[Pi-calculus](https://en.wikipedia.org/wiki/%CE%A0-calculus)
[concurrent lambda calculus](https://www.researchgate.net/publication/2647424_From_a_Concurrent_lambda-calculus_to_the_pi-calculus)
[synchronous pi calculus](https://www.cse.iitd.ac.in/~sak/courses/stc/Milner-SCCS.pdf)
[pi calculus and linear logic](https://pdf.sciencedirectassets.com/271538/1-s2.0-S0304397500X03039/1-s2.0-0304397594001049/main.pdf?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEAwaCXVzLWVhc3QtMSJHMEUCIQCwj%2BbWwEQRLGrZ%2F1FLb8m%2BO5Bto%2BwEQsH1iJQZcnOZ2AIgBhF6bB0vPY%2FDR8WfrZjSsd3%2FqogJ3xXlIOx59BNSxG0qsgUIFBAFGgwwNTkwMDM1NDY4NjUiDIkMRiQEK0naC%2BYZfyqPBWlM0utgCZnB3%2FJKp6PtFoqdA%2FKHXOpKJC6L49yFEB4pvmwyJTIUMUWOWJkJdA0HdhOmaBdkVhLuRfqKZTJfJQXaUtKF%2BMRkddvy1Eg6XLxQXtquydxtPyX8Z6Z2h2ujn4UbKergPCzOo6OXVkiLxMH%2FLQbFqwmURL5tNq0i2gvSFu%2BXkVPHr75UDgxxD6Lj3OWP8fGB3ParvkcbAYY1Y%2Br0kCYLGynMq22%2Bg9D8SXu8MGF2GoKUFcffhMUJAADEk22Ji7LfIHh7AabH5YZyq%2BeqNDIRbd16Y%2BenYn%2Fry9lsZEWaGLzRNV951RX7G%2FzR%2Fk%2BUq7b4c8EUbniefrc9pjK1j0s5P%2Fch0BHTpbCRtF68A1z7GkdfWl3ohpsHZdOgITxtRSBnp3hei5Lspr1ra4A86RLWraQ56H5dtoTSBnSdLss7TEqKOS9OGhwgQrd%2Bqfp0AZExmVaXdDv8Grnlx%2FbZ5dz5b6Cn0s585OdrLIHOZ6UJ7bPrTHFQCaSuTOrs1rATKbQabBUu1hQ1DYilZXvXVCpTNzOMrLOBZOhxdSPcYeyx2LLCUMVQdJ2GXuX2yBAC1lxhz4QPAOD94w1KLYIAD7YFMAAY3Mo9ATgHWqXt4dPj6k2XWDe%2B8iP4VB6jMQEHeXeZIGbLj0mDksHnaJl4WvoDgvS24N9VDjC%2FEduMvBqRlGztM%2BdWt8K2JtJf38pYcFRJYYgxdE4k%2FILBaiW7ps7LQqX1URmM6dAOnOK4MSIeuHavNqjmcDLqVdXeEdUbSeBlo98oDC0QtqbhNquwSnAoTThmGM8pBGvHAHiWfkmv8fqMqFt5eVXJQVf9Mi8jpx2ycAeWmPM%2F0RYEO4vG9i%2BHhWGrlhzNzROu294w3qq2rwY6sQEzo2%2FJhE0MaoVS0ItpYIid2ehNeSLBgoHEq7BWbpVcKn9eMov47krbzXLXWrrf2N%2B3mHO4HflVNr9tvdJdg5ucWOSYXtvp9yDecBLulaOKBAGbhAWRHuxASVpxazW7zVZigO5H%2BacSTdd1UE%2BY771%2FtKAuFZ9JUB5oprnmipCHkVezJRHCzaizR3oNJ6cltD7R2OAzzVho0k2h8oGaRHV1t5xK0qS15Jm13upN3ckpkRw%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240310T113751Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Credential=ASIAQ3PHCVTY5FC7HLNU%2F20240310%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=a99d72d99036c271dad0e2fd7cac90e997cf86f842df8b4311f64fcefa32d3a2&hash=610fec9c745a3e6b252a1692b2324ce07bf50bc9a4afdd9db899ced1c0cb49d1&host=68042c943591013ac2b2430a89b270f6af2c76d8dfd086a07176afe7c76c2c61&pii=0304397594001049&tid=spdf-9d4521b4-6aad-457b-a6d7-aaa2e44c21cb&sid=544ee4f79aa62043146b2cc5131d3b59cf4cgxrqb&type=client&tsoh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&ua=0f055c535154565c0604&rr=862303dcdc8824b6&cc=ua)
[type system for pi calculus](https://pdf.sciencedirectassets.com/271538/1-s2.0-S0304397500X05348/1-s2.0-S0304397503003256/main.pdf?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEA0aCXVzLWVhc3QtMSJGMEQCIH6styyrG3%2F2SgSWfMKJ4wJMZ3HsH%2Bh%2F1LyTkX2ywoANAiAgtH2tGJNe%2FBQpRqGdGOdporiegHPsVHT%2B%2Bt23XqdaPyqzBQgWEAUaDDA1OTAwMzU0Njg2NSIMMOauIM5W6yLYIC4yKpAFiGbJPWwn4C85egTFf2pOVt2UCMFiLNANXU3FLE7cVoC7ZZQUAwhslwhiQPh2K6GgaiUSG8DxXmlefTWhKZTG23%2FDLqzCWS2KDo%2B7ZxGnnv0zjKbN32RkOu15xqcCp%2Fu2%2Bm0i1n2bH2nWn%2Fk4gH3dP4UW40eZ4i9CjL8ET%2FkhF6aaj%2FqdJojqMa1rgttgJnsxgOTyBoLqbMZGwla0IQMDn9oLf6tyDZ0gzTBjwJgynol6GYkdRF5CL6gORvALXetP7NK8AJqn58vboDjybYw0O6nTcXtaf1d9xQJAdJH3JsNIU1Ck5jy%2BWnZ07RdBhpWotRnvzICIhxuVT4iziNFa2X6qg%2F797DPat9H9qS1ibCD3nJTSEjCHGupcsf%2Fr3NY3WKNcVwZBsQml2JmtvLXw4mQgM%2BxSEZt9HZglMSJt%2FtTL%2B3iumGPsgc8EuQ27KXkqdFvD%2FZyuVTPgbk%2FogvDEM%2FjYVQa%2FcQtrwKLrV7LWyX3WZZJqCQwwO0zVUBZldVgKjLVsfe9udb%2F2pU3TfMnsg1lZGv2XoS3OBcTte2dCn8njsVvOBpTaNo%2F%2B1EcBYYAOtnM2yUwAby4srUy1L16yyikrqcA0S3hupHM%2FjspXYF48FQ7QtXugCP9WswKN0gPutIpUnHz%2B1vt8QI94Lut7lefsRTd%2B%2BjH5agCQEwaILIrcj0IMDzZOexqn49uUTYZHD%2BdYat4euE5TlXct0zkT0NJ0%2FY0zrx%2Bbty578c1sA87FGn5qC5IO2JnDHrzSDiuuNFdBCmIbpkhvjqTKHIoSOb8tDRMhj%2FO1fRBbGZzdU7qxlzm3iC0QAdBsRI5Eq6IRa%2F7IJhxhiYNw0QjRUDAkMpyg9KkOb2ZeX9XwC%2FxNt5Qw%2Fc62rwY6sgHSTexLUM%2F82UHM1Nbggi2quB4ogk5nhclYjpOeWScehRvSBz%2BnDAoU3ypzY8XMXBp6Lv4HTKbGvfqR4RWw86cnd7zCKs%2FER8uxvayWoAv77cQYF6xdwwnwYZROAnbcNfYOc%2Bmk5nzM%2FNsYzTb2ThSe3NxVqh%2FybAvG37c45KDt6%2FbwxoTokAJRyHDWCtwy1id3kS7lL176eQO9kiPRQp1LnqWMTVB1zBxKBD6Zlpj1l0eN&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240310T135437Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Credential=ASIAQ3PHCVTY4E7SQHAN%2F20240310%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=efa1484896ab0f1312b8866f312d213fc62ada1af74fe98542a5bfb6a50b95fe&hash=1c7f9e12ea912b5a1f4699994f4b88a6d7b5911f6e2be1bc7d2c5cf76de28102&host=68042c943591013ac2b2430a89b270f6af2c76d8dfd086a07176afe7c76c2c61&pii=S0304397503003256&tid=spdf-2c7284ea-ad4b-46c7-b586-46ddda3ddec2&sid=544ee4f79aa62043146b2cc5131d3b59cf4cgxrqb&type=client&tsoh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&ua=0f055c535154050c5153&rr=8623cc344c3f2d7f&cc=ua)
[another type system](https://www.lacl.fr/~dvaracca/papers/es-pi-mfps.pdf)
[even more type systems](https://hal.science/tel-03920089v2/preview/PREBET_Enguerrand_2022ENSL0017_These.pdf#page=2)
[join calculus](https://github.com/maandree/join-python/blob/master/join-python.pdf)

https://github.com/faiface/par-lang

Pi calculus inherently describes concurrency in homogeneous systems, where every process is computationally equivalent. But many systems are inhomogeneous and that requires special care.

examples:
1. vending machine - buy, sell, shop, query between machine and user
2. web app - potentially unbounded communication between client and server
3. gpu-cpu communication - data transfer and function dispatch
4. slot machine - player chooses to play or stop, machine tells win or lose. Player plays until wins. For non-deterministic machine it may not terminate in general. To cover such models we may demand fair termination instead.
5. e-commerce - buyer add, removes or pays for items. Once it pays the shop is closed
6. oauth - auth of a client on a server through a third party.
7. stream - on-demand item generation/pull
8. consensus - two servers communicate with arbiter to agree on a value. Each of them continuously sending their version and arbiter sending if the agree or not.
9. cell - synchronized value reference.
10. two buyers and a seller - 3-way communication. https://drops.dagstuhl.de/storage/00lipics/lipics-vol042-concur2015/LIPIcs.CONCUR.2015.412/LIPIcs.CONCUR.2015.412.pdf