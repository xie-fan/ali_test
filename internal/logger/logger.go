package logger

import (
	"log"
	"os"
)

type Logger struct {
	debug *log.Logger
	info  *log.Logger
	warn  *log.Logger
	err   *log.Logger
}

func NewLogger() *Logger {
	flags := log.LstdFlags | log.Lshortfile
	return &Logger{
		debug: log.New(os.Stdout, "[DEBUG] ", flags),
		info:  log.New(os.Stdout, "[INFO]  ", flags),
		warn:  log.New(os.Stdout, "[WARN]  ", flags),
		err:   log.New(os.Stderr, "[ERROR] ", flags),
	}
}

func (l *Logger) Debug(msg string) {
	l.debug.Println(msg)
}

func (l *Logger) Debugf(format string, args ...interface{}) {
	l.debug.Printf(format+"\n", args...)
}

func (l *Logger) Info(msg string) {
	l.info.Println(msg)
}

func (l *Logger) Infof(format string, args ...interface{}) {
	l.info.Printf(format+"\n", args...)
}

func (l *Logger) Warn(msg string) {
	l.warn.Println(msg)
}

func (l *Logger) Warnf(format string, args ...interface{}) {
	l.warn.Printf(format+"\n", args...)
}

func (l *Logger) Error(msg string) {
	l.err.Println(msg)
}

func (l *Logger) Errorf(format string, args ...interface{}) {
	l.err.Printf(format+"\n", args...)
}
