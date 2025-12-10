Позволяет описывать конкурентные вычисления.

В пи исчислении существуют следующие конструкции:
1. Переменная `x`, `y` и тд. 
2.  "Канал" - `ch x -> body`. Определяет канал связи между двумя паралельными процессами.
3. "Получение данных" - `x[y] -> body`. Ожидает данных из канала `x`, которые отправит продюсер и выполняет `body` с данными которые пришли.
4. "Отправка данных" - `x(y) rest`. Ждет пока получатель примет данные через канал `x`, и потом выполнить `rest`.
5. "Одновременное выполнение" - `x | y`. Выполняет `х` и `у` "одновременно".
6. "Нулевой процесс" - `0`. Процесс который уже закончился.
7. "Сумма процессов" - `x + y`. Процесс, который выбирает один из процессов `x` или `y` для продолжения вычисления. Елементы суммы должны начинатся с коммуникации, и первый кто будет разблокирован, будет выбран.
8. "Репликация" - `!x`. Процесс, который позволяет создавать неограниченное количество копий внутреннего процесса.

Это исчисление является тьюринг полным и не менее мощным чем любые другие исчисления. На это указывает много работ https://pdf.sciencedirectassets.com/272990/1-s2.0-S1571066100X02514/1-s2.0-S1571066105804748/main.pdf?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEH0aCXVzLWVhc3QtMSJGMEQCICmkJeNMeUwrvCb2e1pnFAIpPSzXcvi4%2BaV4ONcka861AiADdcu%2FEpUsWOhttkh0BlwiIkbo349SqtxWuCSmNLB43yqyBQhGEAUaDDA1OTAwMzU0Njg2NSIMtfV9F3TBKVHBF%2FTbKo8FSvbix9TrJroW182MlfNn3VOijwc90lumdOhFotVb1XoK9041%2FqtV4YFQ5ZlgUh8rsvH6JoFMYsB2CDP1zOPcwkGF%2F7CzDkWbXaz%2FdRgCb%2B%2FdhugL4wDBx4I%2BB%2F5fpwn6LJv%2FxzwSJGA04nyWhYmOpkXvdspYNJKL7r01IJhz%2F9OSYzmHRUqwwBFxMwb42cEpa2OkRnFWbFfzriKUNfBiunqobFwsvWz42vLf6puHcgP%2FtmdhXq2ooPn%2FusvJnsSIbTeGNk3wRhfpDmrZ8lRtxsz30kXCsmq%2FZGyHGvWuAcIukvfUYgzNgHbKlSKF7IrzzR5Va7wPW0PIxgCBAJGIRtOYXRE1RuYoTk%2FgJRU%2BAjIGUVNLqsapAUYaxCJZqVY7V04%2B06YK%2BgD3mkXS8IyE4nXGMLeiw0JHRguggwmnDOq5NXG8uBS943T8%2BbYF6AD%2BNbs4bxd2XePKDg0onnamPet%2Bh685mref6KZCkdl1%2FUUCzlfjMN3rumny5gSGyiJbfBveE6UAUmkxbfPV0tLKqlkLnpvLMaXEfBobAJtCIBMSAYsosn76cjwzUEQJVUBUQXWH%2FscK8My%2BPuzLRmuqTzxr4L6%2BCo0%2BcNmxcocuSOh3RFNGCs%2B%2BHj%2BK0Cy4LtW%2BPXJNTs6ztErGVahT7Ogqu8qUQeBxzmuPj4gF97oAcmeOZ4bc%2FwxmCtGWwg8fYehG5yjmVAOAN7I73bC2CJ%2Beo6dPWC%2BFLgn3reJttiNZWbz92%2F2cdXFD%2FepAplKwrtPcI5TPf1WmtduYZjWJqQMtIaKVJQ6eHczM4qvyeBPQGm57L9OeyqT5QvaFNmwOrJ4f0CBT5NucwoYyDhiywj0D1pQOYkTr%2Fo5RJkA80PjKgjDRhMbJBjqyAcdtZUJc80MXD1VfRcBRODep2SNIzQBnqdvMQPi23HDV7l3yp0QcNaQtMLf6ej5DqRr8hGD0MpJ1oV2FEGAAhUp6HF3xss5Vh6pX%2FzBJsbO24B0yohEDh3BkcEx7KPKZN5oGOoE%2B9KJXbS34NKmBU%2BmgRv4iKSkG7s4k9vv2carpomKZOZtWm1Zy%2BKpBnKcaTwGRzKcctTaiEzJeyj6paQZV6CAL64xAabfbYwrFz4CuWr0%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20251204T133341Z&X-Amz-SignedHeaders=host&X-Amz-Expires=299&X-Amz-Credential=ASIAQ3PHCVTY2K7NQVNF%2F20251204%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=e55b887de5b73e31ca34bcd0129f847e9d9d37838427868d22d3994527ccbd34&hash=17aee9701bcc208c7cc0f3c36e6836f95e0e755dfe5d33d738f4e11d2f5ad295&host=68042c943591013ac2b2430a89b270f6af2c76d8dfd086a07176afe7c76c2c61&pii=S1571066105804748&tid=spdf-aa522525-7cb0-447f-9606-ad07a34fe062&sid=f27f35c44bc44147ef184aa8fb4f75addfd8gxrqb&type=client&tsoh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&rh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&ua=0f075f055a010102505c&rr=9a8bad49de6824c1&cc=ua
file:///D:/Downloads/3-540-59293-8_194.pdf
https://arxiv.org/pdf/2203.11519

https://www.pure.ed.ac.uk/ws/files/24444920/conflate.pdf
http://ctp.di.fct.unl.pt/~lcaires/papers/nondet16.pdf

https://homepages.inf.ed.ac.uk/slindley/papers/sss.pdf

https://arxiv.org/pdf/1904.01290

https://research-information.bris.ac.uk/ws/files/286405141/icfp21main_p4_p_590b69bc2d_52744_final.pdf

towards races https://lmcs.episciences.org/6979/pdf?utm_source=chatgpt.com
https://entics.episciences.org/14735/pdf?utm_source=chatgpt.com
https://ora.ox.ac.uk/objects/uuid%3A5901fe65-d8c0-451f-9a0e-421d33daf8a4/files/s9w032441d?utm_source=chatgpt.com
https://arxiv.org/pdf/2010.13926
https://arxiv.org/pdf/2203.12876
https://arxiv.org/pdf/2212.05457
https://www.semanticscholar.org/paper/Manifest-Deadlock-Freedom-for-Shared-Session-Types-Balzer-Toninho/ab9b997b7fbee74ebf02f6b0cf526259b8c3155f

https://eprints.illc.uva.nl/id/eprint/943/1/MoL-2015-02.text.pdf
https://web.archive.org/web/20240426090831/https://dmg.tuwien.ac.at/aschieri/popl-clinear.pdf
https://www.di.fc.ul.pt/~vv/papers/thiemann.vasconcelos_context-free-session-types.pdf

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

https://www.doc.ic.ac.uk/~dorchard/publ/popl16-orchard-yoshida.pdf
https://members.loria.fr/PdeGroote/papers/tcs2021.pdf?utm_source=chatgpt.com
effect systems as ambients for mobile processes.
modality as generalization of linearity

a semantics, where effect handlers are separate processes, accessed through a channel implicitly passed down the call stack. does this semantics simplify implementation by essentially avoiding non trivial escaping of stack fragments?
I think yes. We can avoid this complexity by making the continuation basically a mobile process. If it is replicable, it even can be multishot. Since this process is a snapshot of the thread's state, every call will instantiate it from that point, together with handlers, stack variables, etc. 

https://decomposition.al/blog/2025/11/20/where-simulation-came-from/

https://link.springer.com/content/pdf/10.1007/978-3-031-30044-8_16.pdf
https://arxiv.org/pdf/2505.20848

CP does not count for race conditions. They are inherently 3-party communication - two contesting sender processes and one receiver process, which directly corresponds to something like `Promise.race`. Dually, there can be two receiver processes and one sender process, contesting for a single resource, which in turn is resolved by mutex-like constructs.
We can see these two scenarios as cases for cooperative and preemptive synchronization. `select`/`Promise.race`-like operation requires preemptive sync, while mutex needs cooperative sync.
liveness

https://homepages.inf.ed.ac.uk/slindley/papers/zap.pdf
https://homepages.inf.ed.ac.uk/slindley/papers/sss.pdf
https://arxiv.org/pdf/1904.01290
https://lmcs.episciences.org/4973/pdf
https://lmcs.episciences.org/6979/pdf

https://chatgpt.com/c/6930ae86-d88c-832c-973f-5d79edaaa106
sum of channels can be added as operation. It will encode racing for receiving/sending through one of these channels. Since there are two cases how it may advance sessions, we need two continuations - in one the first channel is advanced, and the second is unconsumed, and the second is the reverse.
This should preserve every useful property of whatever type system we will have, while unlocking safe race conditions.

shared sessions can be handled with acquire-release semantics. Once we create a shared channel, we can freely duplicate it, but to be used for communication two processes must have exclusive access to it by declaring acquire on it. When matched with accept on the other side, the channel becomes linear for those two processes, and they can communicate as usual. Once they release-detach it, then other processes will be able to acquire it for communication.

https://books.google.com.ua/books?id=QkBL_7VtiPgC&printsec=copyright&redir_esc=y#v=onepage&q&f=false
http://ctp.di.fct.unl.pt/~lcaires/papers/nondet16.pdf
https://link.springer.com/chapter/10.1007/3-540-59293-8_194
https://arxiv.org/pdf/2504.18227
https://www.semanticscholar.org/author/D.-Sangiorgi/1757738?sort=influence

multiparty session types. These are a session type that describe communication between multiple processes in a single entity, that is projected for every participant as a local binary session. These are strictly more expressive than binary ones, because it can describe interdependency of binary sessions uniformly.
https://chatgpt.com/c/69328830-4a4c-8327-a807-0486c009604b

Superposition as a multiset with parallel semantics. Parallel composition as a way to simply fork a process(es) and express parallel execution itself operationally.

https://chatgpt.com/c/6931de33-7a78-832a-a5e7-6c489d1dd83e
Lets say we have a synchronous pi calculus as follows: 
P = 0 | p.P | ch x.P | P1|P2 | sum(p_i.P_i) | !P
p = a | x[y] | x(y)

With main reductions and relations being:
x[y].P|x(z).Q -> P[y/z]|Q
sum(p_i.P_i) -(j)-> p_j.P_j
!P=P|!P

Can you show if the following system is equivalent to it?
Terms:
```
P = 0 | ch x.P|Q | p.P
p = a | x[y] | x(y) | x.choice(l => P1, r => P2) | x.select l | x[] | x() | !x | ?x | (x+y)(z, P, Q) | (x+y)[z1.P, z2.Q]
```

Reductions:
```x[y].P|x(z).Q -> P[y/z]|Q
!x.P = !x.P|x[y].P[x/y]
?x.P = ?x.P|ch y.x(y).P[x/y]
x.choice(l => P, r => P2)|x.select l.Q-> P|Q
x[].P|x().Q -> P|Q
(x+y)(z, P, P2)|x[z1].Q -> P|Q[z1/z]
(x+y)[z1.P, z2.P2]|x(z).Q -> P[z1/z]|Q
```

```
P = 0 | ch x.P|Q | p.P | x(z1).P+y(z2).Q | x[z1].P+y[z2].Q | x(z1).P+y[z2].Q
p = a | x[y] | x(y) | x.choice(l => P1, r => P2) | x.select l | x[] | x() | !x | ?x
```

```x[y].P|x(z).Q -> P[y/z]|Q
!x.P = !x.P|x[y].P[x/y]
?x.P = ?x.P|ch y.x(y).P[x/y]
x.choice(l => P, r => P2)|x.select l.Q-> P|Q
x[].P|x().Q -> P|Q
x(z).P+y(z2).P2|x[z1].Q -> P|Q[z1/z]
x[z1].P+y[z2].P2|x(z).Q -> P[z1/z]|Q
x(z).P+y[z2].P2|x[z1].Q -> P|Q[z1/z]
x(z2).P2+y[z1].P|y(z).Q -> P[z1/z]|Q
```

https://www.reddit.com/r/ProgrammingLanguages/comments/1gabhe8/epsilon_a_programming_langauge_about/
https://www.reddit.com/r/ProgrammingLanguages/comments/1gs95zm/truly_optimal_evaluation_with_unordered/

https://link.springer.com/chapter/10.1007/3-540-57182-5_32
https://epubs.siam.org/doi/epdf/10.1137/S0097539794275860
parallel+nondet (concurrent) lambda calc - extends lambda with `+` and `|`, with them being distributive over application and eachother. These can be seen as disjunction and conjunction over lambda terms
&/| separation - first is an actual product (multiset) of values, second is a sum (nondet union) of values.

https://parlab.eecs.berkeley.edu/sites/all/parlab/files/angelic-acm-dl.pdf
Demonic and angelic nondeterminism are nondet choice and parallel composition.

angelic programming may allow faster development of programs by accepting possibly incomplete programs and giving out a set of outputs it may generate. The incompleteness is encoded as parallel composition of values to consider. By running such programs and examining what values each choice produced (or diverged), we can choose a single suitable value for our final program. Thus programmer can test implementation hypotheses

https://www.irif.fr/~gmanzone/papers/lfcs09.pdf
https://www.sciencedirect.com/science/article/pii/S0167642306002115
Angelic nondeterminism occurs when the choice is made by an ‘angel’: it is assumed that the angel will choose the best possible outcome. Demonic nondeterminism occurs when the choice is made by a ‘demon’: no assumption can be made about the choice made by the demon, so one must be prepared for the worst possible outcome.
On interpretation for "comparing" outcomes is termination - from what we have, we always choose those that terminate, or those that do not terminate at all.

We can define these over multirelations. Multirelation is a set of pairs `x,X`, where x is in `A`, a set of inputs, and X is a subset of `B`, a set of outputs.
With that, angelic choice is union of such sets, while demonic is intersection.
multirelations can be composed. 

One may "resolve" nondeterminism interactively, by "handling" it through a kind of cli.
https://lmcs.episciences.org/2665/pdf?utm_source=chatgpt.com
https://www.researchgate.net/publication/222539946_Axioms_for_Probability_and_Nondeterminism

Modalities multiset and await
We may also resolve it to a single value, depending of which kind of nondet was chosen. If "angelic" is chosen, then we resolve it into the first result we get. For "demonic", we resolve it into a multiset of all the results. We may introduce two operators `race` and `collect` to convert between the two kinds, and another `await` that would collapse them using the corresponding semantics. 

full abstraction

https://pdfs.semanticscholar.org/599f/29c706e273897d80621de1c789f3cc550dea.pdf
we can also introduce pure unguarded choice, which will choose an outcome probabilistically with some probability `p`.

lambda-pi calc and continuation passing style
https://dl.acm.org/doi/pdf/10.1145/263699.263726
https://link.springer.com/chapter/10.1007/978-3-642-37036-6_20
https://ir.cwi.nl/pub/30714/30714.pdf

https://axe-docs.pages.dev/features/concurrency/

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
11. Compare-and-Set (CAS) synchronization primitive https://research-information.bris.ac.uk/ws/files/286405141/icfp21main_p4_p_590b69bc2d_52744_final.pdf
12. Dining philosophers - https://www.cs.cmu.edu/afs/cs/user/fp/www/papers/esop19.pdf