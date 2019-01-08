#!/usr/bin/env node

const parse = require('csv-parse/lib/sync')
const fs = require('fs')
const program = require('commander')
const prompts = require('prompts')
const pug = require('pug')
const puppeteer = require('puppeteer')
const path = require('path')
const htmlPath = path.resolve('imtihan.html')

;(async function () {
  program
    .version('1.0.0')
    .option('-d, --data <string>', 'Data source (CSV)', './data.csv')
    .option('-o, --output <string>', 'Output path (PDF)', './exam.pdf')
    .parse(process.argv)

  const data = await parseData(program.data)

  const questions = [{
    type: 'select',
    name: 'course',
    message: 'Pick a course',
    choices: data.map(q => q.course).filter(onlyUnique).map(c => ({ title: c, value: c })),
    initial: 0
  }, {
    type: 'select',
    name: 'subject',
    message: 'Pick a course',
    choices: (prev) => data.filter(q => q.course === prev).map(q => q.subject).filter(onlyUnique).map(c => ({ title: c, value: c })),
    initial: 0
  }, {
    type: 'select',
    name: 'level',
    message: 'Pick a level',
    choices: (prev, opts) => data.filter(q => q.course === opts.course && q.subject === opts.subject).map(q => q.level).filter(onlyUnique).map(c => ({ title: c, value: c })),
    initial: 0
  }, {
    type: 'confirm',
    name: 'multipleChoices',
    message: 'Are there multiple choices?',
    initial: false
  }, {
    type: 'number',
    name: 'numberOfQuestions',
    message: 'Please enter number of questions',
    initial: 20
  }]

  const options = await prompts(questions)
  await generateExam({ ...options, ...program, questions: data, })
  console.log(`Exam saved at: ${program.output}`)
})()

async function generateExam (options) {
  const filteredQs = options.questions.filter(q => q.course.toLowerCase() === options.course.toLowerCase() && q.level === options.level && q.subject.toLowerCase() === options.subject.toLowerCase())
  
  // check NoQ in source
  if (options.numberOfQuestions > filteredQs.length) {
    throw new Error('There is not enough questions in source')
  }

  var questions
  if (options.numberOfQuestions === filteredQs.length) {
    questions = filteredQs
  } else {
    questions = shuffle(filteredQs).slice(0, options.numberOfQuestions)
  }
  
  await generatePDF(questions, options)
}

/**
 * Generates PDF with questions
 */
async function generatePDF (questions, options) {
  // generate html filte
  const html = pug.renderFile('./template.pug', { questions, program: options })
  fs.writeFileSync(htmlPath, html)
  
  // launch browser
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  
  // load html to browser
  await page.goto(`file:${htmlPath}`, {
    waitUntil: 'networkidle2'
  })
  
  await page.emulateMedia('print');
  
  await page.pdf({
    path: options.output,
    preferCSSPageSize: true,
  })
  
  browser.close()
  fs.unlinkSync(htmlPath)
}

function makeQuestion (data) {
  return {
    course: data['Course'],
    level: data['Level'],
    subject: data['Subject'],
    content: data['Question'],
    answer: data['Answer'],
    answers: data['Choices'] ? data['Choices'].split(',').map(a => a.trim()) : []
  }
}

/**
 * Extracts data by parsing CSV.
 * @param {String} path Path to csv
 * @returns {Promise}
 */
function parseData (path) { 
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, _data) => {
      if (err) {
        reject(err)
        return
      }
      const data = parse(_data, { columns: true, skip_empty_lines: true }).map(makeQuestion)
      resolve(data)
    })
  })
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array Input array
 * @returns {Array} Shuffled array
 */
function shuffle (array) {
  var currentIndex = array.length, temporaryValue, randomIndex
  
  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    
    // And swap it with the current element.
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }
  
  return array
}

function onlyUnique(value, index, self) { 
  return self.indexOf(value) === index;
}
