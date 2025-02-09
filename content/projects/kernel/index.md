+++
image = "os_small.gif"
date = "2023-04-15"
draft = false
title = 'Unix like kernel'
type = "post"
github = 'https://github.com/wonjongbot/391OS'
+++
ECE 391 final MP. Unix like kernel w/ vmem, syscall, multithreading and more.

<!--more-->

## Technical Overview

- - -

Contents

*   [Shell Commands](#shell-commands)
*   [Shell Shortcut Keys](#shell-shortcut-keys)
*   [File System](#file-system)
*   [File System Abstraction](#file-system-abstraction)
*   [File System Directory](#file-system-directory)
*   [Context Switching and Assembly Linkages](#context-switching-and-assembly-linkages)
*   [Exceptions and Exception Handlers](#exceptions-and-exception-handlers)
*   [Interrupts and Interrupt Handlers](#interrupts-and-interrupt-handlers)
*   [Supported Devices and Drivers](#supported-devices-and-drivers)
*   [Memory Addressing](#memory-addressing)
*   [Physical Memory Layout](#physical-memory-layout)
*   [Virtual Memory Layout](#virtual-memory-layout)
*   [System Calls](#system-calls)
*   [Process Control: Execute and Halt](#process-control-execute-and-halt)
*   [Process Switching and Scheduler](#process-switching-and-scheduler)
*   [Background Switching and Multiterminals](#background-switching-and-multiterminals)

### Shell Commands

| Command | Description |
| --- | --- |
| exit | Quit the current shell instance. If the exited process is the root shell, another shell instance is launched. |
| \[Executable\] \[Arg\] | Search for and execute a program in the current terminal. Some programs may require additional arguments (see [File System Directory](#file-system-directory)). |

### Shell Shortcut Keys

| Combination | Action | Description |
| --- | --- | --- |
| Alt+F1 | Switch to Terminal 1 | (See [Background Switching and Multiterminals](#background-switching-and-multiterminals)) |
| Alt+F2 | Switch to Terminal 2 | (See [Background Switching and Multiterminals](#background-switching-and-multiterminals)) |
| Alt+F3 | Switch to Terminal 3 | (See [Background Switching and Multiterminals](#background-switching-and-multiterminals)) |
| Ctrl+L | Clear Screen | Clears the video memory and resets the cursor position. |
<!-- | Ctrl+C | Interrupt | Quit the active process in the current terminal. | -->
<!-- | _Ctrl+S_ | _Enable/Disable Scheduler_ | _(See [Process Switching/Scheduler](#process-switchingscheduler))_ | -->
<!-- | _Ctrl+V_ | _Enable/Disable Verbose Mode_ | _Print the verbose outputs (for debugging only)._ | -->
<!-- | _Ctrl+P_ | _Start 391OS-36 Process Manager_ | _(See [Process Manager](#pmgr))_ | -->
<!-- | _Ctrl+H_ | _Start 391OS-36 Help Center_ | _Show the combination keys and about info_ | -->

### File System

The read-only file system is 8MB in total size, divided into 4KB blocks consisting of a single boot block, multiple inodes, and data blocks.

Each boot block tracks up to 62 inodes and one root directory, while each inode can reference up to 1023 data blocks.

Thus, the system supports up to 62 files with a maximum file size of 4092KB and file names of up to 32 characters. The file system is flat (non-hierarchical) and read-only.

### File System Abstraction

Everything is a file! Including regular files, devices (e.g., RTC), and directories (see [File System Directory](#file-system-directory)).

Each process maintains a dynamic file descriptor (FD) table, supporting up to 8 open files. Each FD entry tracks the associated inode, file position, access flags, and a function pointer table depending on the file type. These structures are directly used by system calls (see [System Calls](#system-calls)).

### File System Directory

| File Name | File Kind | Description |
| --- | --- | --- |
| .   | Directory | Holds the information and refers to the root directory itself. |
| sigtest | Executable | **Argument: 0 or any.** Used to test signals.  <br>Use argument "0" to generate a Page Fault (PF) without trying to install a handler.  <br>_Use any argument except "0" to install handlers for alarm and segfault, and then generate a PF._ |
| shell | Executable | 391OS shell, the underlying program running in each terminal. |
| grep | Executable | **Argument: a pattern.** Prints lines that contain a match for the pattern in each files' contents. |
| syserr | Executable | Used to test illegal system call arguments. |
| rtc | Device | Giving user-level access to the Real-Time Clock (RTC). |
| fish | Executable | Used to test the vidmap system call and RTC. Display a fish animation on the current terminal. |
| counter | Executable | A numerical counter. |
| pingpong | Executable | Used to test RTC. Infiniately print a ping-pong animation on the current terminal.  <br>Can only be terminated by Ctrl+C (interrupt signal) or the Process Manager. |
| cat | Executable | **Argument: a file name.** Try to open and read the content of a file (or directory/device). |
| frame0.txt | Regular File | A frame of the fish animation. |
| verylarge~.txt | Regular File | Used to test the very long file name handling of the terminal driver. |
| ls  | Executable | List all files in the directory. |
| testprint | Executable | Used to test the standard printing of the terminal driver. |
| created.txt | Regular File | Author information left by ECE 391 staff. |
| frame1.txt | Regular File | Another frame of the fish animation. |
| hello | Executable | Used to test the input buffer of the terminal driver. |

Unless specifically listed above, programs usually don't accept any argument.  
The contents of the file system were provided by the ECE 391 staff.

### Context Switch/Assembly Linkages

When an interrupt, exception, or system call occurs, the processor jumps to a corresponding assembly linkage in kernel space.

This mechanism, known as **context switching**, occurs periodically when the scheduler is enabled, as PIT (Programmable Interval Timer) interrupts trigger scheduling events.

The assembly linkages for interrupts, exceptions, and system calls differ, but all of them construct a hardware context on the kernel stack to facilitate process switching and restoration.

Arguments for system calls are passed via registers, and upon completion, the system restores the saved hardware context (tearing down the kernel stack) before executing `IRET` (Interrupt Return) to resume execution.

When returning back from the interrupt handler and to the user space, assembly linkage will restore the hardware context saved in the stack before executing `IRET`.  

When halting/executing a new process (see [Execute/Halt](#process-control-execute-and-halt) and [Switch](#process-switching-and-scheduler)), seperate context is built, then the kernel will switch to the next program's Prgram Counter (PC) and stack.  

_Context switching is expensive due to the need to save and restore registers, memory mappings, and process control structures._

| Type | Generated By | Asynchronous | Unexpected |
| --- | --- | --- | --- |
| Interrupts | External device needs attention | YES | YES |
| Exceptions | Kernel/user program behaving wildly | NO  | YES |
| System Calls (see [System Calls](#system-calls)) | User program, deliberately via INT x80 | NO  | NO  |

### Exception/Exception Handlers

An exception happens when the user program (or even worse, kernel) attempts an operation that is illegal or outside of defined behavior (e.g. division by zero or accessing illegal pages). This doesn't mean exception is necessarily "unexpected"; exception simply means operation deviates from the normal flow of execution.

Exceptions are synchronized (happens within the program flow). When an exception is generated, the processor jumps to the specific assembly linkage (see [Assembly Linkages](##context-switchassembly-linkages)), which in turn calls the unified exception handler. 

Then, the handler will display the error message, debug information. _(In a modern kernel, signal is sent to the process if the exception is recoverable, but signal is not supported in our OS)_. If no handler was installed, the default behavior is killing the offending process.  

If an exception is detected in kernel mode, the exception is non-recoverable and Kernal will halt. The host machine to be restarted.

### Interrupt/Interrupt Handlers

An interrupt happens when a piece of hardware needs processor's attention, such as keyboard input, RTC, and PIC. Such operation is expected/unpredictable in the Kernel's/program flow's point of view.

The OS only contains essential drivers (see [Supported Devices/Drivers](#supported-devicesdrivers)). Interrupt lines (IRQs) are masked and ignored.

The IRQ lines are managed by two i8259 PICs just like any other mainstream IBM-compatible PC.  

Interrupts are asynchronous. When an interrupt is raised and processor is alerted, the kernel jumps to the specific assembly linkage (see [Assembly Linkages](##context-switchassembly-linkages)).  

The interrupt assmebly linkage pushes information and calls an unified interrupt handler.  

Then, the handler will call the corresponding driver, and the driver will handle the remaining work (again, see [Supported Devices/Drivers](#supported-devicesdrivers)).

### Supported Devices/Drivers

The 391OS-36 has drivers for the standard keyboard, Programmable Interval Timer (PIT), Real-Time Clock (RTC), and terminal.  

Keyboard, PIT, and RTC drivers are for real devices and contains handlers for their interrupts (see [Interrupt/Interrupt Handlers](#interruptinterrupt-handlers)).  

The standard keyboard driver is responsible for servicing key presses. Uppercase/lowercase typing and combinational key handling is also supported. 

The PIT and RTC all generates interrupts periodically.  

The PIT and its driver are used to handle the scheduling and can be turned off (see [Process Switching/Scheduler](#process-switchingscheduler)). It is only accessible by the kernel itself.  

The RTC is user-level accessible and it is "virtualized" for each process by the RTC driver, so they all have its own instance and frenquency.  

_Above is why PIT us used for task scheduling. You don't want an user program to tamper with the scheduler frequency._  

The terminal driver is for stdio operations, and works as a bridge that connects user/devices to the terminal/kernel.  

There are three terminals(see [Background Switching/Multiterminals](#background-switchingmultiterminals)). The input buffer for each terminal is limited to 128-characters.  

### Memory Addressing

The kernel bypasses segmentation just like any mainstream modern operation systems. 

Only paging was used for the memory addressing.  

The memory layout is fixed (see [Physical Memory Layout](#physical-memory-layout) and [Virtual Memory Layout](#virtual-memory-layout)).  

### Physical Memory Layout

From low to high, the kernel utilizes the following 32MB physical memory:  

*   4MB space with five 4KB space for the VRAM for the active terminal, 3 terminal backups, and an extra backup space (see [Multiterminals](#background-switchingmultiterminals))
*   4MB space for the kernel data (mostly Process Control Blocks (PCBs) and Terminal Info (TI) blocks) and kernel stack (see [Process Control](#process-controlexecutehalt) and [Multiterminals](#background-switchingmultiterminals))
*   Six 4MB spaces for user applications' binary and stack (see [Process Control](#process-controlexecutehalt))

### Virtual Memory Layout

From low to high, the kernel has mapped the 4GB virtual memory space for each user program:  

*   4MB managed by a superviser Page Table (PT), with five 4KB superviser pages, going through from the physical memory (see [Physical Memory Layout](#physical-memory-layout))
*   4MB superviser jumbo page for the kernel, going through from the physical memory (see [Physical Memory Layout](#physical-memory-layout))
*   4MB user page at address address 128MB, for the current running program only (see [Process Control](#process-controlexecutehalt))
*   4MB managed by a user PT, with a 4KB vidmap page for the current active program, controlled by the vidmap (see [System Calls](#system-calls) and [Multiterminals](#background-switchingmultiterminals))

### System Calls

| System Call | Description |
| --- | --- |
| halt | Halt the current program (process). For the halt procedure, see [Process Control/Execute/Halt](#process-controlexecutehalt). |
| execute | Load and execute a new program. For the execute procedure, see [Process Control/Execute/Halt](#process-controlexecutehalt). |
| read | Read data from a opened file (see file system abstraction above). |
| write | Write data to a file (support terminal and device/RTC only). |
| open | Allocate a FD entry and open a file. |
| close | Close the FD entry and close a file. |
| getargs | Return the command line argument. It is extracted during the execute system call. |
| vidmap | Giving the user-level access to the current VRAM by mapping it to the vidmap page, which is user-level accessible. |

System calls are generated deliberately by user programs by generating a "soft interrupt," INT x80 on x86 systems.  

When a system call was generated, the processor jumps to the system call assembly linkage (see [Context Switch/Assembly Linkages](##context-switchassembly-linkages)).  

Arguments for system calls are carried by %EAX, %EBX, %ECX, and %EDX registers.  
The linkage will check if the arguments are valid, and then hand the job to the corresponding system call handler.

### Process Control/Execute/Halt

The kernel supports up to 6 processes. In the kernel space, each process holds a kernel stack and a **Process Control Block (PCB)**.  

In the user space, each process holds their own user page (see [Virtual Memory Layout](#virtual-memory-layout)) which contains the executable binary and a user stack.  

By having their own kernel and user stacks, their hardware context and user stack data won't be overwritten by other programs.  

Each PCB tracks the allocated process ID (PID), parent PID, terminal ID, kernel/user stacks, FD, etc.  
<!-- 
The kernel manages the PCB allocation by a custom design called _PCB pool_.  
This custom design allows the 391OS-36 to allocate and free the PCB resources freely.   -->

When **creating a new process (execute system call, see [System Calls](#system-calls))**, the OS first runs sanity check, extracts the program name and argument.

PCB is allocated, user page is created, program binary is copied, FDs are initialized, bookkeeping is done (to retrun to parent process upon exit).  

Finally, it will switch the kernel stack, build a custom hardware context with the new PC and user stack, and return to the linkage for context switch(see [Assembly Linkages](##context-switchassembly-linkages)).  

When **a process is halted (halt system call, see [System Calls](#system-calls))**, the OS will free the resources, tearing down the user page, vidmap, and FD.  

Then, the allocated PCB block is freed, restore the context of the parent process' information and return to the linkage.

### Process Switching/Scheduler

The kernel supports a round-robin scheduler, prompted by the PIT interrupt (see [Supported Devices/Drivers](#supported-devicesdrivers)).

While 6 processes are supported, only 3 of them are scheduled, and 1 at a time is actually being executed (other 2 processes are paused until it is unfrozen by the scheduler).  

The scheduler schedules 3 processes that is shown on each terminal (active process), constantly switching and is able to be multitasked.

But only one program is "actually" running (running process), as this is a kernel that only accounts for a uniprocessor system.

The **program switching** begins in the kernel with the hardware context saved. It is pretty much like a halt call, but it will preserve the current resources and context.

Then, kernel page and stack, and context are switch to the next scheduled process's information. Kernel then returns to the linkage (see [Assembly Linkages](##context-switchassembly-linkages)). 

### Background Switching/Multiterminals

The OS supports up to 3 (active) terminals. Each terminal tracks the current active program, PCB pointer, coordinations, etc. Scheduler relies on these information to properly function. 

When **active process is switched in the background**, a lot of extra works needs to be done. One of the big needs is to switching to with separate VRAMs.

The running process cannot print to user display when it is not active. The kernel handles this is by having 5 individual VRAM pages (see [Physical Memory Layout](#physical-memory-layout)) and switching the page mapping based on the current running process. 

When a **running terminal is being serviced**, the kernel will backup the previous processes's VRAM to its VRAM page, copy the corresponding VRAM to the display, and remap the vidmap.  

---
I was able to write this Technical Overview thanks to Peizhe's help ([website](https://os.paizhang.info/))