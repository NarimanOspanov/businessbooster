// Программы обучения по предметам «Луча» (кроме физики, она описана в index.html).
// Формат как у физики: branches — ветки-разделы, topics — темы { id, b, g, t, items, req },
// b: 'base' — общие основы (верх карты); g — класс; req — что нужно пройти до темы.
// Порядок классов и содержание опираются на школьную программу Казахстана (обновлённое содержание).
window.LUCH_SUBJECTS = {
  math: {
    title: 'Математика от простого к сложному',
    intro: 'Школьная математика с 5 по 11 класс: от действий с числами до производной и вероятностей. Сверху основы, ниже четыре ветки. Нажмите на тему, чтобы увидеть, что в ней и что стоит пройти до неё.',
    grades: [5, 6, 7, 8, 9, 10, 11],
    branches: [
      { id: 'alg', name: 'Алгебра', c: 'var(--c-mech)' },
      { id: 'fn', name: 'Функции и анализ', c: 'var(--c-opt)' },
      { id: 'geo', name: 'Геометрия', c: 'var(--c-elec)' },
      { id: 'prob', name: 'Вероятность и статистика', c: 'var(--c-mod)' },
    ],
    topics: [
      { id: 'num', b: 'base', g: 5, t: 'Натуральные числа', items: ['Действия и их порядок', 'Делимость', 'Простые числа', 'НОД и НОК'], req: [], status: 'done', href: '/labs/math-num/', lessons: 4, doneItems: 4 },
      { id: 'frac', b: 'base', g: 5, t: 'Дроби и проценты', items: ['Обыкновенные дроби', 'Десятичные дроби', 'Проценты', 'Отношения и пропорции'], req: [], status: 'done', href: '/labs/math-frac/', lessons: 4, doneItems: 4 },

      { id: 'neg', b: 'alg', g: 6, t: 'Рациональные числа', items: ['Положительные и отрицательные', 'Модуль числа', 'Координатная прямая', 'Действия со знаками'], req: ['num'], status: 'done', href: '/labs/math-neg/', lessons: 4, doneItems: 4 },
      { id: 'expr', b: 'alg', g: 7, t: 'Выражения и уравнения', items: ['Буквенные выражения', 'Линейные уравнения', 'Задачи на составление уравнений'], req: ['neg', 'frac'], status: 'done', href: '/labs/math-expr/', lessons: 3, doneItems: 3 },
      { id: 'poly', b: 'alg', g: 7, t: 'Многочлены', items: ['Степень с натуральным показателем', 'Одночлены и многочлены', 'Формулы сокращённого умножения', 'Разложение на множители'], req: ['expr'], status: 'done', href: '/labs/math-poly/', lessons: 4, doneItems: 4 },
      { id: 'systems', b: 'alg', g: 7, t: 'Системы уравнений', items: ['Уравнение с двумя переменными', 'Способ подстановки', 'Способ сложения', 'Графический способ'], req: ['expr'], status: 'done', href: '/labs/math-systems/', lessons: 4, doneItems: 4 },
      { id: 'roots', b: 'alg', g: 8, t: 'Квадратные корни', items: ['Иррациональные числа', 'Свойства корней', 'Преобразования с корнями'], req: ['poly'], status: 'done', href: '/labs/math-roots/', lessons: 3, doneItems: 3 },
      { id: 'quad', b: 'alg', g: 8, t: 'Квадратные уравнения', items: ['Дискриминант', 'Теорема Виета', 'Дробно-рациональные уравнения', 'Задачи на движение и работу'], req: ['roots'], status: 'done', href: '/labs/math-quad/', lessons: 4, doneItems: 4 },
      { id: 'ineq', b: 'alg', g: 9, t: 'Неравенства', items: ['Линейные неравенства', 'Квадратные неравенства', 'Метод интервалов', 'Системы неравенств'], req: ['quad'], status: 'done', href: '/labs/math-ineq/', lessons: 4, doneItems: 4 },
      { id: 'seq', b: 'alg', g: 9, t: 'Прогрессии', items: ['Числовые последовательности', 'Арифметическая прогрессия', 'Геометрическая прогрессия', 'Сложные проценты и вклады'], req: ['expr'], status: 'done', href: '/labs/math-seq/', lessons: 4, doneItems: 4 },
      { id: 'explog', b: 'alg', g: 11, t: 'Степени и логарифмы', items: ['Корень n-й степени', 'Показательная функция', 'Логарифмы', 'Показательные и логарифмические уравнения'], req: ['ineq', 'fquad'] },

      { id: 'coord', b: 'fn', g: 6, t: 'Координатная плоскость', items: ['Координаты точки', 'Графики зависимостей', 'Чтение графиков'], req: ['neg'], status: 'done', href: '/labs/math-coord/', lessons: 3, doneItems: 3 },
      { id: 'linf', b: 'fn', g: 7, t: 'Линейная функция', items: ['Что такое функция', 'y = kx + b', 'Угловой коэффициент', 'Пересечение графиков'], req: ['coord', 'expr'], status: 'done', href: '/math/', lessons: 2, doneItems: 4 },
      { id: 'fquad', b: 'fn', g: 9, t: 'Квадратичная функция', items: ['Парабола', 'Вершина и ось симметрии', 'Сдвиги и растяжения графиков'], req: ['linf', 'quad'], status: 'done', href: '/math/', lessons: 3, doneItems: 3 },
      { id: 'trig', b: 'fn', g: 10, t: 'Тригонометрия', items: ['Единичная окружность', 'Основные формулы', 'Графики синуса и косинуса', 'Тригонометрические уравнения'], req: ['fquad', 'pyth'], status: 'done', href: '/labs/math-trig/', lessons: 4, doneItems: 4 },
      { id: 'deriv', b: 'fn', g: 10, t: 'Производная', items: ['Скорость изменения и предел', 'Правила дифференцирования', 'Касательная', 'Исследование функции'], req: ['fquad'], status: 'done', href: '/labs/math-deriv/', lessons: 4, doneItems: 4 },
      { id: 'integ', b: 'fn', g: 11, t: 'Интеграл', items: ['Первообразная', 'Площадь под графиком', 'Формула Ньютона — Лейбница'], req: ['deriv'] },

      { id: 'shapes', b: 'geo', g: 5, t: 'Наглядная геометрия', items: ['Углы и транспортир', 'Периметр и площадь', 'Объём параллелепипеда', 'Окружность и круг'], req: ['num'], status: 'done', href: '/labs/math-shapes/', lessons: 4, doneItems: 4 },
      { id: 'gbase', b: 'geo', g: 7, t: 'Начала геометрии', items: ['Точки, прямые, отрезки', 'Смежные и вертикальные углы', 'Параллельные прямые', 'Как доказывать'], req: ['shapes'], status: 'done', href: '/labs/math-gbase/', lessons: 4, doneItems: 4 },
      { id: 'tri', b: 'geo', g: 7, t: 'Треугольники', items: ['Признаки равенства', 'Равнобедренный треугольник', 'Сумма углов', 'Построения циркулем'], req: ['gbase'], status: 'done', href: '/labs/math-tri/', lessons: 4, doneItems: 4 },
      { id: 'quadr', b: 'geo', g: 8, t: 'Четырёхугольники', items: ['Параллелограмм', 'Прямоугольник, ромб, квадрат', 'Трапеция', 'Площади многоугольников'], req: ['tri'], status: 'done', href: '/labs/math-quadr/', lessons: 4, doneItems: 4 },
      { id: 'pyth', b: 'geo', g: 8, t: 'Пифагор и подобие', items: ['Теорема Пифагора', 'Подобные треугольники', 'Синус, косинус, тангенс угла'], req: ['quadr', 'roots'], status: 'done', href: '/labs/math-pyth/', lessons: 3, doneItems: 3 },
      { id: 'circ', b: 'geo', g: 8, t: 'Окружность', items: ['Касательная', 'Вписанные углы', 'Вписанная и описанная окружность'], req: ['tri'], status: 'done', href: '/labs/math-circ/', lessons: 3, doneItems: 3 },
      { id: 'vect', b: 'geo', g: 9, t: 'Векторы и координаты', items: ['Векторы', 'Метод координат', 'Уравнение окружности и прямой'], req: ['pyth', 'coord'], status: 'done', href: '/labs/math-vect/', lessons: 3, doneItems: 3 },
      { id: 'stereo', b: 'geo', g: 10, t: 'Стереометрия', items: ['Аксиомы пространства', 'Параллельность и перпендикулярность', 'Углы и расстояния'], req: ['vect'], status: 'done', href: '/labs/math-stereo/', lessons: 3, doneItems: 3 },
      { id: 'solids', b: 'geo', g: 11, t: 'Тела и объёмы', items: ['Призма и пирамида', 'Цилиндр, конус, шар', 'Площади поверхности', 'Объёмы тел'], req: ['stereo'] },

      { id: 'data', b: 'prob', g: 6, t: 'Данные и диаграммы', items: ['Таблицы', 'Столбчатые и круговые диаграммы', 'Среднее арифметическое'], req: ['frac'], status: 'done', href: '/labs/math-data/', lessons: 3, doneItems: 3 },
      { id: 'comb', b: 'prob', g: 9, t: 'Комбинаторика', items: ['Правило умножения', 'Перестановки', 'Сочетания', 'Треугольник Паскаля'], req: ['num'], status: 'done', href: '/labs/math-comb/', lessons: 4, doneItems: 4 },
      { id: 'probab', b: 'prob', g: 9, t: 'Вероятность', items: ['Случайные события', 'Классическая вероятность', 'Сложение и умножение вероятностей'], req: ['comb', 'frac'], status: 'done', href: '/labs/math-probab/', lessons: 3, doneItems: 3 },
      { id: 'stat', b: 'prob', g: 10, t: 'Статистика', items: ['Медиана и мода', 'Разброс и дисперсия', 'Выборки и опросы', 'Как графики вводят в заблуждение'], req: ['data', 'probab'] },
      { id: 'rv', b: 'prob', g: 11, t: 'Случайные величины', items: ['Математическое ожидание', 'Биномиальное распределение', 'Закон больших чисел'], req: ['stat'] },
    ],
  },

  chem: {
    title: 'Химия от простого к сложному',
    intro: 'Школьная химия с 7 по 11 класс: от смесей и атомов до органики и электролиза. Сверху основы, ниже пять веток. Нажмите на тему, чтобы увидеть, что в ней и что стоит пройти до неё.',
    grades: [7, 8, 9, 10, 11],
    branches: [
      { id: 'struct', name: 'Строение вещества', c: 'var(--c-elec)' },
      { id: 'react', name: 'Реакции и расчёты', c: 'var(--c-mech)' },
      { id: 'inorg', name: 'Неорганическая химия', c: 'var(--c-opt)' },
      { id: 'org', name: 'Органическая химия', c: 'var(--c-mod)' },
      { id: 'life', name: 'Химия вокруг нас', c: 'var(--c-heat)' },
    ],
    topics: [
      { id: 'subst', b: 'base', g: 7, t: 'Вещества и смеси', items: ['Чистые вещества и смеси', 'Физические и химические явления', 'Разделение смесей', 'Безопасность в лаборатории'], req: [], status: 'done', href: '/labs/chem-subst/', lessons: 4, doneItems: 4 },
      { id: 'atoms', b: 'base', g: 7, t: 'Атомы и молекулы', items: ['Химический элемент', 'Знаки элементов', 'Химическая формула', 'Относительная масса'], req: [], status: 'done', href: '/labs/chem-atoms/', lessons: 4, doneItems: 4 },

      { id: 'valence', b: 'struct', g: 7, t: 'Валентность и формулы', items: ['Валентность', 'Составление формул', 'Простые и сложные вещества'], req: ['atoms'], status: 'done', href: '/labs/chem-valence/', lessons: 3, doneItems: 3 },
      { id: 'atomst', b: 'struct', g: 8, t: 'Строение атома', items: ['Протоны, нейтроны, электроны', 'Изотопы', 'Электронные оболочки'], req: ['atoms'], status: 'done', href: '/labs/chem-atomst/', lessons: 3, doneItems: 3 },
      { id: 'table', b: 'struct', g: 8, t: 'Периодическая система', items: ['Закон Менделеева', 'Периоды и группы', 'Металлы и неметаллы', 'Как предсказать свойства'], req: ['atomst'], status: 'done', href: '/labs/chem-table/', lessons: 4, doneItems: 4 },
      { id: 'bonds', b: 'struct', g: 8, t: 'Химическая связь', items: ['Ковалентная связь', 'Ионная связь', 'Металлическая связь', 'Кристаллические решётки'], req: ['table'], status: 'done', href: '/labs/chem-bonds/', lessons: 4, doneItems: 4 },
      { id: 'redox', b: 'struct', g: 9, t: 'Окислительно-восстановительные реакции', items: ['Степень окисления', 'Окислитель и восстановитель', 'Электронный баланс'], req: ['bonds', 'equations'], status: 'done', href: '/labs/chem-redox/', lessons: 3, doneItems: 3 },

      { id: 'equations', b: 'react', g: 8, t: 'Химические реакции', items: ['Признаки реакций', 'Уравнения реакций', 'Закон сохранения массы', 'Типы реакций'], req: ['valence', 'subst'], status: 'done', href: '/labs/chem-equations/', lessons: 4, doneItems: 4 },
      { id: 'mole', b: 'react', g: 8, t: 'Количество вещества', items: ['Моль и число Авогадро', 'Молярная масса', 'Молярный объём газов', 'Расчёты по уравнениям'], req: ['equations'], status: 'done', href: '/labs/chem-mole/', lessons: 4, doneItems: 4 },
      { id: 'solutions', b: 'react', g: 8, t: 'Растворы', items: ['Растворимость', 'Массовая доля', 'Молярная концентрация', 'Как приготовить раствор'], req: ['mole'], status: 'done', href: '/chemistry/', lessons: 3, doneItems: 4 },
      { id: 'ions', b: 'react', g: 9, t: 'Электролиты и ионы', items: ['Электролитическая диссоциация', 'Ионные уравнения', 'Кислотность и pH'], req: ['solutions', 'bonds'], status: 'part', href: '/chemistry/', lessons: 2, doneItems: 0 },
      { id: 'kinetics', b: 'react', g: 10, t: 'Скорость и равновесие', items: ['Скорость реакции', 'Катализаторы', 'Химическое равновесие', 'Принцип Ле Шателье'], req: ['ions'], status: 'done', href: '/labs/chem-kinetics/', lessons: 4, doneItems: 4 },
      { id: 'electro', b: 'react', g: 11, t: 'Электрохимия', items: ['Ряд активности металлов', 'Гальванический элемент и батарейка', 'Электролиз', 'Коррозия'], req: ['redox', 'ions'], status: 'done', href: '/labs/chem-electro/', lessons: 4, doneItems: 4 },

      { id: 'oxy', b: 'inorg', g: 8, t: 'Кислород, водород, вода', items: ['Кислород и горение', 'Водород', 'Вода и её свойства', 'Состав воздуха'], req: ['equations'], status: 'done', href: '/labs/chem-oxy/', lessons: 4, doneItems: 4 },
      { id: 'classes', b: 'inorg', g: 8, t: 'Классы веществ', items: ['Оксиды', 'Кислоты', 'Основания', 'Соли', 'Как они превращаются друг в друга'], req: ['oxy', 'valence'], status: 'done', href: '/labs/chem-classes/', lessons: 5, doneItems: 5 },
      { id: 'nonmet', b: 'inorg', g: 9, t: 'Неметаллы', items: ['Галогены', 'Сера', 'Азот и аммиак', 'Фосфор', 'Углерод и кремний'], req: ['classes', 'table'], status: 'done', href: '/labs/chem-nonmet/', lessons: 5, doneItems: 5 },
      { id: 'metals', b: 'inorg', g: 9, t: 'Металлы', items: ['Щелочные металлы', 'Кальций и магний', 'Алюминий', 'Железо', 'Сплавы'], req: ['classes', 'table'], status: 'done', href: '/labs/chem-metals/', lessons: 5, doneItems: 5 },
      { id: 'industry', b: 'inorg', g: 11, t: 'Химическое производство', items: ['Аммиак и серная кислота', 'Металлургия Казахстана', 'Минеральные удобрения'], req: ['nonmet', 'metals', 'kinetics'], status: 'done', href: '/labs/chem-industry/', lessons: 3, doneItems: 3 },

      { id: 'orgbase', b: 'org', g: 10, t: 'Основы органики', items: ['Почему углерод особенный', 'Строение органических молекул', 'Изомерия', 'Названия веществ'], req: ['bonds'], status: 'done', href: '/labs/chem-orgbase/', lessons: 4, doneItems: 4 },
      { id: 'hydro', b: 'org', g: 10, t: 'Углеводороды', items: ['Алканы', 'Алкены и алкины', 'Арены', 'Нефть и газ'], req: ['orgbase'], status: 'done', href: '/labs/chem-hydro/', lessons: 4, doneItems: 4 },
      { id: 'oxyorg', b: 'org', g: 10, t: 'Спирты, альдегиды, кислоты', items: ['Спирты', 'Альдегиды', 'Карбоновые кислоты', 'Сложные эфиры и жиры'], req: ['hydro'], status: 'done', href: '/labs/chem-oxyorg/', lessons: 4, doneItems: 4 },
      { id: 'biomol', b: 'org', g: 11, t: 'Молекулы жизни', items: ['Углеводы', 'Аминокислоты и белки', 'Нуклеиновые кислоты'], req: ['oxyorg'], status: 'done', href: '/labs/chem-biomol/', lessons: 3, doneItems: 3 },
      { id: 'polymers', b: 'org', g: 11, t: 'Полимеры', items: ['Пластмассы', 'Волокна', 'Каучук и резина', 'Переработка пластика'], req: ['hydro'], status: 'done', href: '/labs/chem-polymers/', lessons: 4, doneItems: 4 },

      { id: 'home', b: 'life', g: 8, t: 'Химия дома', items: ['Моющие средства', 'Кислоты и щёлочи на кухне', 'Бытовая безопасность'], req: ['classes'], status: 'done', href: '/labs/chem-home/', lessons: 3, doneItems: 3 },
      { id: 'food', b: 'life', g: 9, t: 'Еда и здоровье', items: ['Белки, жиры, углеводы', 'Витамины', 'Как работают лекарства'], req: ['classes'], status: 'done', href: '/labs/chem-food/', lessons: 3, doneItems: 3 },
      { id: 'eco', b: 'life', g: 11, t: 'Химия и экология', items: ['Загрязнение воздуха и воды', 'Парниковый эффект', 'Зелёная химия'], req: ['nonmet', 'polymers'], status: 'done', href: '/labs/chem-eco/', lessons: 3, doneItems: 3 },
    ],
  },

  bio: {
    title: 'Биология от простого к сложному',
    intro: 'Школьная биология с 7 по 11 класс: от клетки и растений до генетики, эволюции и экологии. Сверху основы, ниже пять веток. Нажмите на тему, чтобы увидеть, что в ней и что стоит пройти до неё.',
    grades: [7, 8, 9, 10, 11],
    branches: [
      { id: 'cell', name: 'Клетка и молекулы', c: 'var(--c-mod)' },
      { id: 'div', name: 'Многообразие жизни', c: 'var(--c-mech)' },
      { id: 'human', name: 'Человек', c: 'var(--c-heat)' },
      { id: 'gen', name: 'Наследственность и эволюция', c: 'var(--c-elec)' },
      { id: 'eco', name: 'Экология', c: 'var(--c-opt)' },
    ],
    topics: [
      { id: 'alive', b: 'base', g: 7, t: 'Признаки живого', items: ['Обмен веществ', 'Рост и развитие', 'Размножение', 'Уровни организации жизни'], req: [], status: 'done', href: '/labs/bio-alive/', lessons: 4, doneItems: 4 },
      { id: 'methods', b: 'base', g: 7, t: 'Как изучают жизнь', items: ['Наблюдение и эксперимент', 'Микроскоп', 'Как поставить опыт'], req: [], status: 'done', href: '/labs/bio-methods/', lessons: 3, doneItems: 3 },

      { id: 'cellst', b: 'cell', g: 7, t: 'Строение клетки', items: ['Мембрана и оболочка', 'Ядро', 'Органоиды', 'Клетки растений и животных'], req: ['alive', 'methods'], status: 'done', href: '/labs/bio-cellst/', lessons: 4, doneItems: 4 },
      { id: 'tissues', b: 'cell', g: 7, t: 'Ткани и органы', items: ['Ткани растений', 'Ткани животных', 'Органы и системы органов'], req: ['cellst'], status: 'done', href: '/labs/bio-tissues/', lessons: 3, doneItems: 3 },
      { id: 'chemcell', b: 'cell', g: 10, t: 'Химия клетки', items: ['Вода и минеральные вещества', 'Белки', 'Углеводы и липиды', 'ДНК и РНК'], req: ['cellst'], status: 'done', href: '/labs/bio-chemcell/', lessons: 4, doneItems: 4 },
      { id: 'metab', b: 'cell', g: 10, t: 'Обмен веществ', items: ['Ферменты', 'Фотосинтез', 'Клеточное дыхание', 'АТФ — батарейка клетки'], req: ['chemcell'], status: 'done', href: '/labs/bio-metab/', lessons: 4, doneItems: 4 },
      { id: 'division', b: 'cell', g: 10, t: 'Деление клетки', items: ['Митоз', 'Мейоз', 'Жизненный цикл клетки'], req: ['chemcell'], status: 'done', href: '/labs/bio-division/', lessons: 3, doneItems: 3 },
      { id: 'biotech', b: 'cell', g: 11, t: 'Биотехнологии', items: ['Генная инженерия', 'Клонирование', 'ПЦР-тесты', 'Биобезопасность'], req: ['division', 'mendel'], status: 'done', href: '/labs/bio-biotech/', lessons: 4, doneItems: 4 },

      { id: 'micro', b: 'div', g: 7, t: 'Бактерии, грибы, вирусы', items: ['Бактерии', 'Грибы и лишайники', 'Вирусы', 'Микробы и здоровье'], req: ['cellst'], status: 'done', href: '/labs/bio-micro/', lessons: 4, doneItems: 4 },
      { id: 'plants', b: 'div', g: 7, t: 'Растения', items: ['Корень, стебель, лист', 'Цветок и плод', 'Водоросли, мхи, папоротники', 'Голосеменные и цветковые'], req: ['tissues'], status: 'done', href: '/labs/bio-plants/', lessons: 4, doneItems: 4 },
      { id: 'plantlife', b: 'div', g: 8, t: 'Как живёт растение', items: ['Минеральное питание', 'Фотосинтез в листе', 'Испарение воды', 'Размножение растений'], req: ['plants'], status: 'done', href: '/labs/bio-plantlife/', lessons: 4, doneItems: 4 },
      { id: 'inverts', b: 'div', g: 8, t: 'Беспозвоночные', items: ['Простейшие', 'Черви', 'Моллюски', 'Членистоногие и насекомые'], req: ['tissues'], status: 'done', href: '/labs/bio-inverts/', lessons: 4, doneItems: 4 },
      { id: 'verts', b: 'div', g: 8, t: 'Позвоночные', items: ['Рыбы', 'Земноводные и пресмыкающиеся', 'Птицы', 'Млекопитающие'], req: ['inverts'], status: 'done', href: '/labs/bio-verts/', lessons: 4, doneItems: 4 },

      { id: 'body', b: 'human', g: 9, t: 'Опора и движение', items: ['Скелет', 'Мышцы', 'Осанка и травмы'], req: ['verts'], status: 'done', href: '/labs/bio-body/', lessons: 3, doneItems: 3 },
      { id: 'blood', b: 'human', g: 9, t: 'Кровь и сердце', items: ['Состав крови', 'Сердце', 'Сосуды и давление', 'Иммунитет и прививки'], req: ['body'], status: 'done', href: '/labs/bio-blood/', lessons: 4, doneItems: 4 },
      { id: 'digest', b: 'human', g: 9, t: 'Дыхание и питание', items: ['Лёгкие и дыхание', 'Пищеварение', 'Питание и витамины', 'Выделение'], req: ['blood'], status: 'done', href: '/labs/bio-digest/', lessons: 4, doneItems: 4 },
      { id: 'nerves', b: 'human', g: 9, t: 'Мозг и чувства', items: ['Нейрон и рефлекс', 'Головной мозг', 'Зрение и слух', 'Сон и память'], req: ['body'], status: 'done', href: '/labs/bio-nerves/', lessons: 4, doneItems: 4 },
      { id: 'hormones', b: 'human', g: 9, t: 'Гормоны и взросление', items: ['Железы внутренней секреции', 'Половое созревание', 'Рост организма'], req: ['nerves'], status: 'done', href: '/labs/bio-hormones/', lessons: 3, doneItems: 3 },
      { id: 'health', b: 'human', g: 9, t: 'Здоровье и первая помощь', items: ['Первая помощь', 'Вредные привычки', 'Гигиена и режим дня'], req: ['blood'], status: 'done', href: '/labs/bio-health/', lessons: 3, doneItems: 3 },

      { id: 'mendel', b: 'gen', g: 10, t: 'Законы наследственности', items: ['Гены и признаки', 'Законы Менделя', 'Решётка Пеннета', 'Наследование пола'], req: ['division'], status: 'part', href: '/biology/', lessons: 5, doneItems: 3 },
      { id: 'variation', b: 'gen', g: 10, t: 'Изменчивость', items: ['Мутации', 'Модификации', 'Наследственные болезни'], req: ['mendel'], status: 'done', href: '/labs/bio-variation/', lessons: 3, doneItems: 3 },
      { id: 'selection', b: 'gen', g: 11, t: 'Селекция', items: ['Сорта и породы', 'Гибридизация', 'Селекция микроорганизмов'], req: ['variation'], status: 'done', href: '/labs/bio-selection/', lessons: 3, doneItems: 3 },
      { id: 'evolution', b: 'gen', g: 11, t: 'Эволюция', items: ['Дарвин и естественный отбор', 'Вид и видообразование', 'Доказательства эволюции'], req: ['variation', 'verts'], status: 'done', href: '/labs/bio-evolution/', lessons: 3, doneItems: 3 },
      { id: 'origin', b: 'gen', g: 11, t: 'Происхождение жизни и человека', items: ['Как появилась жизнь', 'Этапы развития жизни', 'Эволюция человека'], req: ['evolution'] },

      { id: 'env', b: 'eco', g: 8, t: 'Организм и среда', items: ['Факторы среды', 'Приспособления', 'Биоритмы'], req: ['plants'], status: 'done', href: '/labs/bio-env/', lessons: 3, doneItems: 3 },
      { id: 'ecosys', b: 'eco', g: 10, t: 'Экосистемы', items: ['Пищевые цепи', 'Круговорот веществ', 'Устойчивость экосистем'], req: ['env', 'metab'], status: 'done', href: '/labs/bio-ecosys/', lessons: 3, doneItems: 3 },
      { id: 'biosphere', b: 'eco', g: 11, t: 'Биосфера', items: ['Учение Вернадского', 'Природные зоны планеты', 'Человек и биосфера'], req: ['ecosys', 'evolution'] },
      { id: 'protect', b: 'eco', g: 11, t: 'Охрана природы', items: ['Красная книга', 'Заповедники Казахстана', 'Устойчивое развитие'], req: ['biosphere'] },
    ],
  },

  cs: {
    title: 'Информатика от простого к сложному',
    intro: 'Информатика с 5 по 11 класс: от первых алгоритмов до Python, сайтов, баз данных и искусственного интеллекта. Сверху основы, ниже четыре ветки. Нажмите на тему, чтобы увидеть, что в ней и что стоит пройти до неё.',
    grades: [5, 6, 7, 8, 9, 10, 11],
    branches: [
      { id: 'prog', name: 'Алгоритмы и программирование', c: 'var(--c-mod)' },
      { id: 'data', name: 'Данные и логика', c: 'var(--c-elec)' },
      { id: 'net', name: 'Сети и интернет', c: 'var(--c-opt)' },
      { id: 'tech', name: 'Технологии и ИИ', c: 'var(--c-mech)' },
    ],
    topics: [
      { id: 'pc', b: 'base', g: 5, t: 'Компьютер и файлы', items: ['Устройство компьютера', 'Файлы и папки', 'Работа с текстом'], req: [], status: 'done', href: '/labs/cs-pc/', lessons: 3, doneItems: 3 },
      { id: 'info', b: 'base', g: 5, t: 'Информация', items: ['Что такое информация', 'Кодирование', 'Биты и байты'], req: [], status: 'done', href: '/labs/cs-info/', lessons: 3, doneItems: 3 },

      { id: 'algo', b: 'prog', g: 5, t: 'Алгоритмы', items: ['Исполнители', 'Последовательность команд', 'Блок-схемы'], req: ['info'], status: 'done', href: '/labs/cs-algo/', lessons: 3, doneItems: 3 },
      { id: 'blocks', b: 'prog', g: 6, t: 'Визуальное программирование', items: ['Scratch', 'Циклы', 'Условия', 'Своя игра'], req: ['algo'], status: 'done', href: '/labs/cs-blocks/', lessons: 4, doneItems: 4 },
      { id: 'python', b: 'prog', g: 7, t: 'Первые программы на Python', items: ['Ввод и вывод', 'Переменные', 'Условия', 'Циклы'], req: ['blocks'], status: 'done', href: '/labs/cs-python/', lessons: 4, doneItems: 4 },
      { id: 'func', b: 'prog', g: 8, t: 'Функции и списки', items: ['Функции', 'Списки', 'Строки', 'Поиск ошибок'], req: ['python'], status: 'done', href: '/labs/cs-func/', lessons: 4, doneItems: 4 },
      { id: 'algos', b: 'prog', g: 9, t: 'Алгоритмы обработки', items: ['Поиск', 'Сортировки', 'Сложность алгоритма', 'Рекурсия'], req: ['func'], status: 'done', href: '/labs/cs-algos/', lessons: 4, doneItems: 4 },
      { id: 'oop', b: 'prog', g: 10, t: 'Структуры данных и ООП', items: ['Словари и множества', 'Классы и объекты', 'Работа с файлами'], req: ['algos'], status: 'done', href: '/labs/cs-oop/', lessons: 3, doneItems: 3 },
      { id: 'project', b: 'prog', g: 11, t: 'Свой проект', items: ['Веб-приложение или бот', 'Git и работа в команде', 'Тестирование', 'Презентация проекта'], req: ['oop', 'web'], status: 'done', href: '/labs/cs-project/', lessons: 4, doneItems: 4 },

      { id: 'binary', b: 'data', g: 6, t: 'Системы счисления', items: ['Двоичная система', 'Перевод чисел', 'Шестнадцатеричная система'], req: ['info'], status: 'done', href: '/informatics/', lessons: 5, doneItems: 3 },
      { id: 'sheets', b: 'data', g: 7, t: 'Электронные таблицы', items: ['Формулы', 'Ссылки на ячейки', 'Диаграммы', 'Сортировка и фильтр'], req: ['pc'], status: 'done', href: '/labs/cs-sheets/', lessons: 4, doneItems: 4 },
      { id: 'logic', b: 'data', g: 8, t: 'Логика', items: ['Высказывания', 'И, ИЛИ, НЕ', 'Таблицы истинности', 'Логические схемы'], req: ['binary'], status: 'done', href: '/labs/cs-logic/', lessons: 4, doneItems: 4 },
      { id: 'db', b: 'data', g: 9, t: 'Базы данных', items: ['Таблицы и связи', 'Запросы SQL', 'Проектирование базы'], req: ['sheets', 'logic'], status: 'done', href: '/labs/cs-db/', lessons: 3, doneItems: 3 },
      { id: 'analysis', b: 'data', g: 10, t: 'Анализ данных', items: ['Сбор и очистка данных', 'Визуализация', 'Python для данных'], req: ['db', 'func'], status: 'done', href: '/labs/cs-analysis/', lessons: 3, doneItems: 3 },

      { id: 'safe', b: 'net', g: 5, t: 'Интернет и безопасность', items: ['Поиск информации', 'Надёжные пароли', 'Цифровой след', 'Как распознать фейк'], req: ['pc'], status: 'done', href: '/labs/cs-safe/', lessons: 4, doneItems: 4 },
      { id: 'networks', b: 'net', g: 8, t: 'Компьютерные сети', items: ['Как устроен интернет', 'IP-адреса и DNS', 'Протоколы'], req: ['binary', 'safe'], status: 'done', href: '/labs/cs-networks/', lessons: 3, doneItems: 3 },
      { id: 'web', b: 'net', g: 9, t: 'Создание сайтов', items: ['HTML', 'CSS', 'Основы JavaScript', 'Публикация сайта'], req: ['networks', 'python'], status: 'done', href: '/labs/cs-web/', lessons: 4, doneItems: 4 },
      { id: 'cyber', b: 'net', g: 10, t: 'Кибербезопасность', items: ['Шифрование', 'Атаки и защита', 'Этичный хакинг'], req: ['networks', 'logic'], status: 'done', href: '/labs/cs-cyber/', lessons: 3, doneItems: 3 },

      { id: 'media', b: 'tech', g: 6, t: 'Графика и медиа', items: ['Растровая и векторная графика', 'Звук и видео', 'Сжатие файлов'], req: ['info'], status: 'done', href: '/labs/cs-media/', lessons: 3, doneItems: 3 },
      { id: 'robot', b: 'tech', g: 7, t: 'Робототехника', items: ['Датчики', 'Моторы', 'Программирование робота'], req: ['blocks'], status: 'done', href: '/labs/cs-robot/', lessons: 3, doneItems: 3 },
      { id: 'ai', b: 'tech', g: 10, t: 'Искусственный интеллект', items: ['Машинное обучение', 'Нейросети', 'Как работают чат-боты', 'Этика ИИ'], req: ['analysis'], status: 'done', href: '/labs/cs-ai/', lessons: 4, doneItems: 4 },
      { id: 'career', b: 'tech', g: 11, t: 'IT-профессии и стартапы', items: ['Кем работать в IT', 'Как устроен стартап', 'Цифровые сервисы и деньги'], req: ['ai', 'web'], status: 'done', href: '/labs/cs-career/', lessons: 3, doneItems: 3 },
    ],
  },
};
