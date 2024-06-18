/*

Register definitions for SPI hard-block

*/

`ifndef _spi_reg_
`define _spi_reg_

`define SPI_CR0     (4'b1000)   // SPI Control Register 0 (Read/Write)
`define SPI_CR1     (4'b1001)   // SPI Control Register 1 (Read/Write)
`define SPI_CR2     (4'b1010)   // SPI Control Register 2 (Read/Write)
`define SPI_BR      (4'b1011)   // SPI Baud Rate Register (Read/Write)
`define SPI_TXDR    (4'b1101)   // SPI Transmit Data Register (Read/Write)
`define SPI_RXDR    (4'b1110)   // SPI Receive Data Register (Read-Only)
`define SPI_CSR     (4'b1111)   // SPI Chip Select Mask For Master Mode (Read/Write)
`define SPI_SR      (4'b1100)   // SPI Status Register (Read-Only)
`define SPI_ISR     (4'b0110)   // SPI Interrupt Status Register (Read/Write*)
`define SPI_ICR     (4'b0111)   // SPI Interrupt Control Register (Read/Write)

`endif
