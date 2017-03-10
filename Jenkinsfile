node {
    stage('Build') {
        checkout scm
        sh 'npm install'
    }
    stage('ESLint') {
        sh 'npm run eslint'
    }
}
